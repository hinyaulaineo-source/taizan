import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { WorkoutProgressBar, WorkoutProgressRing } from '@/components/ui/workout-progress'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'

export default async function CoachDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const { data: sessions } = await supabase
    .from('sessions')
    .select('*')
    .eq('created_by', user.id)
    .order('created_at', { ascending: false })
    .order('scheduled_at', { ascending: true })

  const { data: feedbackRows } = await supabase
    .from('feedback')
    .select('athlete_id, created_at, profiles!feedback_athlete_id_fkey(full_name, email)')
    .eq('coach_id', user.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const coachSessionIds = new Set((sessions ?? []).map((s) => s.id))
  const { data: coachBookings } = coachSessionIds.size > 0
    ? await supabase
        .from('bookings')
        .select('athlete_id, session_id, booked_at')
        .in('session_id', Array.from(coachSessionIds))
    : { data: [] as Array<{ athlete_id: string; session_id: string; booked_at: string }> }

  const roster = (() => {
    const map = new Map<string, { athlete_id: string; full_name: string | null; email: string; last_created_at: string; bookingCount: number }>()
    ;(feedbackRows ?? []).forEach((f: any) => {
      if (!f.athlete_id) return
      if (!map.has(f.athlete_id)) {
        map.set(f.athlete_id, {
          athlete_id: f.athlete_id,
          full_name: f.profiles?.full_name ?? null,
          email: f.profiles?.email ?? '',
          last_created_at: f.created_at,
          bookingCount: 0,
        })
      }
    })
    ;(coachBookings ?? []).forEach((b) => {
      const existing = map.get(b.athlete_id)
      if (existing) {
        existing.bookingCount += 1
      }
    })
    return Array.from(map.values())
  })()

  const totalCoachSessions = coachSessionIds.size || 1

  const sessionsByCreatedDate = (() => {
    const groups = new Map<string, typeof sessions>()
    ;(sessions ?? []).forEach((s) => {
      const key = s.created_at
        ? new Date(s.created_at).toLocaleDateString()
        : 'Unknown date'
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    })
    return Array.from(groups.entries())
  })()

  return (
    <main>
      <h1 className="text-2xl font-semibold text-foreground">Coach Dashboard</h1>
      <p className="mt-1 text-sm text-muted-foreground">Welcome, {profile?.full_name ?? user.email}</p>

      <div className="mt-6 grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">My sessions</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{sessions?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Pending approval</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {sessions?.filter((s) => s.status === 'pending').length ?? 0}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Published</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">
              {sessions?.filter((s) => s.status === 'published').length ?? 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-base font-semibold text-foreground">Master calendar</h2>
        <Calendar
          events={(() => {
            const dateKeyFromScheduledAt = (scheduledAt: string) => {
              const d = new Date(scheduledAt)
              const yyyy = d.getFullYear()
              const mm = String(d.getMonth() + 1).padStart(2, '0')
              const dd = String(d.getDate()).padStart(2, '0')
              return `${yyyy}-${mm}-${dd}`
            }

            return (sessions ?? []).map(
              (s): CalendarEvent => ({
                dateKey: dateKeyFromScheduledAt(s.scheduled_at),
                sessionId: s.id,
                title: `${s.title} (${s.status})`,
                isBooked: s.status === 'published',
                canBook: false,
              }),
            )
          })()}
          bookingLink="/dashboard/coach/new-session"
          initialMonth={new Date()}
        />
      </section>

      <section className="mt-8">
        <div className="mb-3 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <h2 className="text-base font-semibold text-foreground">My sessions</h2>
          <div className="flex gap-2">
            <Link
              href="/dashboard/coach/feedback"
              className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
            >
              + Add feedback
            </Link>
            <Link
              href="/dashboard/coach/new-session"
              className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              + New session
            </Link>
          </div>
        </div>

        {sessions?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No sessions yet. Create your first one.</p>
            </CardContent>
          </Card>
        )}

        {sessionsByCreatedDate.length > 0 && (
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {sessionsByCreatedDate.map(([createdDate, group]) => (
              <div key={createdDate}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    Created on {createdDate}
                  </p>
                  {group && group.length > 0 ? (
                    <Link
                      href={`/dashboard/coach/edit-session/${group[0].id}?batch=1`}
                      className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                    >
                      Edit batch
                    </Link>
                  ) : null}
                </div>
                {group?.map((session) => (
                  <Card key={session.id} className="mb-2">
                    <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                      <div>
                        <p className="text-sm font-semibold text-foreground">{session.title}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {session.session_type} · {new Date(session.scheduled_at).toLocaleDateString('en-GB', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' })}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge
                          tone={
                            session.status === 'published'
                              ? 'success'
                              : session.status === 'pending'
                                ? 'warning'
                                : 'neutral'
                          }
                        >
                          {session.status}
                        </Badge>
                        <Link
                          href={`/dashboard/coach/check-in/${session.id}`}
                          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                        >
                          Check-in
                        </Link>
                        <Link
                          href={`/dashboard/coach/edit-session/${session.id}`}
                          className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                        >
                          Edit
                        </Link>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">My roster</h2>
        {roster.length === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No athlete feedback saved yet.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-2">
            {roster.map((a) => {
              const pct = Math.min(100, Math.round((a.bookingCount / totalCoachSessions) * 100))
              return (
                <Card key={a.athlete_id}>
                  <CardContent className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{a.full_name ?? 'Unnamed'}</p>
                      <p className="text-xs text-muted-foreground">{a.email}</p>
                      <div className="mt-2 w-48">
                        <WorkoutProgressBar value={pct} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <WorkoutProgressRing value={pct} />
                      <Badge tone="neutral">Last: {new Date(a.last_created_at).toLocaleDateString()}</Badge>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>
    </main>
  )
}
