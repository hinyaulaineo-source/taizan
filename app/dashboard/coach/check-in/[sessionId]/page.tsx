import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import AttendanceChecklist from './AttendanceChecklist'

interface PageProps {
  params: Promise<{ sessionId: string }>
}

export default async function CheckInPage({ params }: PageProps) {
  const { sessionId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const { data: session } = await supabase
    .from('sessions')
    .select('id, title, session_type, scheduled_at, location, max_athletes')
    .eq('id', sessionId)
    .single()

  if (!session) redirect('/dashboard/coach')

  const { data: bookings } = await supabase
    .from('bookings')
    .select('athlete_id, profiles!bookings_athlete_id_fkey(id, full_name, email)')
    .eq('session_id', sessionId)
    .eq('status', 'booked')

  const { data: existingAttendance } = await supabase
    .from('attendance')
    .select('athlete_id, checked_in')
    .eq('session_id', sessionId)

  const attendanceMap = new Map<string, boolean | null>()
  ;(existingAttendance ?? []).forEach((a) => {
    attendanceMap.set(a.athlete_id, a.checked_in)
  })

  const athletes = (bookings ?? []).map((b: any) => ({
    id: b.profiles?.id ?? b.athlete_id,
    fullName: b.profiles?.full_name ?? 'Unnamed',
    email: b.profiles?.email ?? '',
    status: attendanceMap.has(b.athlete_id)
      ? attendanceMap.get(b.athlete_id) ? 'present' as const : 'absent' as const
      : 'unmarked' as const,
  }))

  return (
    <main className="mx-auto max-w-3xl">
      <Link href="/dashboard/coach" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to coach dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Check-in: {session.title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        {session.session_type} ·{' '}
        {new Date(session.scheduled_at).toLocaleDateString('en-GB', {
          weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        })}
        {session.location ? ` · ${session.location}` : ''}
      </p>

      <Card className="mt-6">
        <CardContent>
          {athletes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No athletes booked for this session.</p>
          ) : (
            <AttendanceChecklist sessionId={sessionId} athletes={athletes} />
          )}
        </CardContent>
      </Card>
    </main>
  )
}
