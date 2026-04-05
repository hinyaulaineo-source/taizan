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

  const { data: assignedAthletes } = await supabase
    .from('profiles')
    .select('id, full_name, email')
    .eq('role', 'athlete')
    .eq('primary_coach_id', user.id)
    .order('full_name', { ascending: true })

  const assignedIds = new Set((assignedAthletes ?? []).map((a) => a.id))

  const coachSessionIds = new Set((sessions ?? []).map((s) => s.id))
  const { data: coachBookings } = coachSessionIds.size > 0
    ? await supabase
        .from('bookings')
        .select('athlete_id, session_id, booked_at, profiles!bookings_athlete_id_fkey(full_name, email)')
        .in('session_id', Array.from(coachSessionIds))
    : { data: [] as Array<{ athlete_id: string; session_id: string; booked_at: string; profiles: { full_name: string | null; email: string } | null }> }

  const roster = (() => {
    const map = new Map<string, { athlete_id: string; full_name: string | null; email: string; last_feedback_at: string | null; bookingCount: number }>()

    ;(coachBookings ?? []).forEach((b: any) => {
      const existing = map.get(b.athlete_id)
      if (existing) {
        existing.bookingCount += 1
      } else {
        map.set(b.athlete_id, {
          athlete_id: b.athlete_id,
          full_name: b.profiles?.full_name ?? null,
          email: b.profiles?.email ?? '',
          last_feedback_at: null,
          bookingCount: 1,
        })
      }
    })

    ;(feedbackRows ?? []).forEach((f: any) => {
      if (!f.athlete_id) return
      const existing = map.get(f.athlete_id)
      if (existing) {
        if (!existing.last_feedback_at || f.created_at > existing.last_feedback_at) {
          existing.last_feedback_at = f.created_at
        }
        if (!existing.full_name && f.profiles?.full_name) {
          existing.full_name = f.profiles.full_name
        }
        if (!existing.email && f.profiles?.email) {
          existing.email = f.profiles.email
        }
      } else {
        map.set(f.athlete_id, {
          athlete_id: f.athlete_id,
          full_name: f.profiles?.full_name ?? null,
          email: f.profiles?.email ?? '',
          last_feedback_at: f.created_at,
          bookingCount: 0,
        })
      }
    })

    return Array.from(map.values())
  })()

  const rosterById = new Map(roster.map((a) => [a.athlete_id, a]))
  const alsoInteracted = roster.filter((a) => !assignedIds.has(a.athlete_id))

  const totalCoachSessions = coachSessionIds.size || 1

  const sessionsByBatch = (() => {
    const groups = new Map<string, typeof sessions>()
    ;(sessions ?? []).forEach((s) => {
      const key = s.created_at ?? 'unknown'
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    })
    return Array.from(groups.entries()).map(([key, group]) => {
      const first = group![0]
      const title = first.title ?? 'Untitled'
      const date = key !== 'unknown'
        ? new Date(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'Unknown date'
      const label = group!.length > 1
        ? `${title} — ${group!.length} sessions (${date})`
        : `${title} (${date})`
      return { key, label, group: group! }
    })
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
          weeklyLink="/dashboard/coach/weekly"
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

        {sessionsByBatch.length > 0 && (
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {sessionsByBatch.map(({ key, label, group }) => (
              <div key={key}>
                <div className="mb-2 flex items-center justify-between gap-2">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {label}
                  </p>
                  {group.length > 1 ? (
                    <Link
                      href={`/dashboard/coach/edit-session/${group[0].id}?batch=1`}
                      className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                    >
                      Edit batch
                    </Link>
                  ) : null}
                </div>
                {group.map((session) => (
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
        <h2 className="mb-3 text-base font-semibold text-foreground">
          My assigned athletes
          <span className="ml-2 text-sm font-normal text-zinc-500">
            ({assignedAthletes?.length ?? 0})
          </span>
        </h2>
        {(assignedAthletes?.length ?? 0) === 0 ? (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                No athletes assigned to you yet. The club owner can assign athletes to you from the owner
                dashboard.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
            {(assignedAthletes ?? []).map((athlete) => {
              const a = rosterById.get(athlete.id)
              const pct = a
                ? Math.min(100, Math.round((a.bookingCount / totalCoachSessions) * 100))
                : 0
              return (
                <Card key={athlete.id}>
                  <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {athlete.full_name ?? 'Unnamed'}
                      </p>
                      <p className="text-xs text-muted-foreground">{athlete.email}</p>
                      {a ? (
                        <div className="mt-2 w-48">
                          <WorkoutProgressBar value={pct} />
                        </div>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {a ? (
                        <>
                          <WorkoutProgressRing value={pct} />
                          {a.last_feedback_at ? (
                            <Badge tone="neutral">
                              Last: {new Date(a.last_feedback_at).toLocaleDateString('en-GB')}
                            </Badge>
                          ) : (
                            <Badge tone="warning">No feedback yet</Badge>
                          )}
                        </>
                      ) : (
                        <Badge tone="neutral">No sessions yet</Badge>
                      )}
                      <Link
                        href={`/dashboard/coach/athletes/${athlete.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                      >
                        Edit profile
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        )}
      </section>

      {alsoInteracted.length > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-foreground">
            Also interacted with
            <span className="ml-2 text-sm font-normal text-zinc-500">({alsoInteracted.length})</span>
          </h2>
          <p className="mb-3 text-xs text-muted-foreground">
            Athletes from bookings or feedback who are not in your assigned roster.
          </p>
          <div className="max-h-[360px] space-y-2 overflow-y-auto pr-1">
            {alsoInteracted.map((a) => {
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
                      {a.last_feedback_at ? (
                        <Badge tone="neutral">
                          Last: {new Date(a.last_feedback_at).toLocaleDateString('en-GB')}
                        </Badge>
                      ) : (
                        <Badge tone="warning">No feedback yet</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </section>
      ) : null}
    </main>
  )
}
