import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
import { Card, CardContent } from '@/components/ui/card'
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav'
import TrainingLogForm from '../TrainingLogForm'
import TrainingProgressionChart from '../TrainingProgressionChart'
import TrainingLogTable from './TrainingLogTable'

export default async function AthleteTrainingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)

  const { data: trainingLogs } = await supabase
    .from('training_logs')
    .select('id, logged_at, distance_km, duration_seconds, running_percent, note')
    .eq('athlete_id', user.id)
    .order('logged_at', { ascending: true })

  const chartPoints = (trainingLogs ?? []).map((row) => ({
    id: row.id,
    loggedAt: row.logged_at as string,
    distanceMeters: Number(row.distance_km) * 1000,
    durationSeconds: Number(row.duration_seconds),
    runningPercent: Number(row.running_percent),
  }))

  const tableRows = [...(trainingLogs ?? [])].sort(
    (a, b) => new Date(b.logged_at as string).getTime() - new Date(a.logged_at as string).getTime(),
  )

  return (
    <main className="pb-20 md:pb-0">
      {ownerPreview && (
        <div className="mb-6 rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
          You’re viewing training logs as an owner. Data is tied to your account in preview mode.
        </div>
      )}

      <div className="mb-8">
        <Link
          href="/dashboard/athlete"
          className="text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          ← Athlete dashboard
        </Link>
        <h1 className="mt-3 text-2xl font-semibold text-foreground">Training progression</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Charts and a complete list of every session you’ve logged.
        </p>
      </div>

      <Card className="mb-10">
        <CardContent>
          <h2 className="mb-1 text-sm font-semibold text-foreground">Trends</h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Log distance, time, and how much of the session was running. Switch the chart metric to compare trends
            over time.
          </p>
          <TrainingProgressionChart logs={chartPoints} />
          <TrainingLogForm />
        </CardContent>
      </Card>

      <section>
        <h2 className="mb-3 text-sm font-semibold text-foreground">All sessions</h2>
        <TrainingLogTable
          rows={tableRows.map((row) => ({
            id: String(row.id),
            logged_at: String(row.logged_at),
            distance_km: Number(row.distance_km),
            duration_seconds: Number(row.duration_seconds),
            running_percent: Number(row.running_percent),
            note: (row.note as string | null) ?? null,
          }))}
        />
      </section>

      <MobileBottomNav role="athlete" />
    </main>
  )
}
