import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAthleteDashboard } from '@/lib/auth/roles'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import CancelBookingButton from './CancelBookingButton'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function AthleteSessionDetailsPage({ params }: PageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const { data: booking } = await supabase
    .from('bookings')
    .select('status, booked_at, sessions(id, title, session_type, location, scheduled_at, max_athletes, programs(content_md))')
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (!booking?.sessions) redirect('/dashboard/athlete')

  const session = booking.sessions as any
  const statusTone = booking.status === 'booked' ? 'success' : 'neutral'

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/dashboard/athlete" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to athlete dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Session details</h1>
      <p className="mt-1 text-sm text-muted-foreground">View full information for your booked session.</p>

      <Card className="mt-6">
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-foreground">{session.title}</h2>
            <Badge tone={statusTone}>{booking.status}</Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Session type</p>
              <p className="mt-1 text-sm text-foreground">{session.session_type}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Scheduled</p>
              <p className="mt-1 text-sm text-foreground">
                {new Date(session.scheduled_at).toLocaleString('en-GB', {
                  weekday: 'short',
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="mt-1 text-sm text-foreground">{session.location || 'TBD'}</p>
            </div>
            <div className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">Capacity</p>
              <p className="mt-1 text-sm text-foreground">
                {session.max_athletes ? `${session.max_athletes} athletes` : 'Not limited'}
              </p>
            </div>
          </div>

          {(session.programs as any)?.content_md ? (
            <div className="rounded-lg border border-border bg-background p-3">
              <p className="mb-2 text-xs text-muted-foreground">Coach program / notes</p>
              <p className="whitespace-pre-wrap text-sm text-foreground">{(session.programs as any).content_md}</p>
            </div>
          ) : null}

          <p className="text-xs text-muted-foreground">
            Booked on: {new Date(booking.booked_at).toLocaleString('en-GB')}
          </p>

          {booking.status === 'booked' ? <CancelBookingButton sessionId={session.id} /> : null}
        </CardContent>
      </Card>
    </main>
  )
}
