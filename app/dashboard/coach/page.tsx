import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { WorkoutProgressBar, WorkoutProgressRing } from '@/components/ui/workout-progress'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'
import SessionQuotaEditor from '@/components/dashboard/SessionQuotaEditor'
import { currentQuotaMonthISO, isQuotaColumnError } from '@/lib/session-quota'
import { formatHkDate, hkDateParts } from '@/lib/hk-date'
import CoachSessionList from './CoachSessionList'

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

  const assignedAthleteIds = (assignedAthletes ?? []).map((a) => a.id)
  let assignedSubs: Array<{
    user_id: string
    tier: string
    status: string
    monthly_session_allowance?: number | null
    sessions_remaining?: number | null
    quota_month?: string | null
  }> = []
  if (assignedAthleteIds.length > 0) {
    const withQuota = await supabase
      .from('subscriptions')
      .select('user_id, tier, status, monthly_session_allowance, sessions_remaining, quota_month')
      .in('user_id', assignedAthleteIds)
    if (withQuota.error && isQuotaColumnError(withQuota.error)) {
      const fallback = await supabase
        .from('subscriptions')
        .select('user_id, tier, status')
        .in('user_id', assignedAthleteIds)
      assignedSubs = fallback.data ?? []
    } else {
      assignedSubs = withQuota.data ?? []
    }
  }

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
          events={(sessions ?? []).map(
            (s): CalendarEvent => ({
              dateKey: hkDateParts(s.scheduled_at).dateKey,
              sessionId: s.id,
              title: `${s.title} (${s.status})`,
              isBooked: s.status === 'published',
              canBook: false,
            }),
          )}
          bookingLink="/dashboard/coach/new-session"
          weeklyLink="/dashboard/coach/weekly"
          monthlyLink="/dashboard/coach/monthly"
          initialDateKey={hkDateParts(new Date()).dateKey}
        />
      </section>

      <CoachSessionList
        currentMonth={currentQuotaMonthISO().slice(0, 7)}
        sessions={(sessions ?? []).map((s) => ({
          id: s.id,
          title: s.title,
          session_type: s.session_type,
          status: s.status,
          created_at: s.created_at,
          monthKey: hkDateParts(s.scheduled_at).monthKey,
          dateLabel: formatHkDate(s.scheduled_at),
          createdLabel: s.created_at ? formatHkDate(s.created_at) : 'Unknown date',
        }))}
      />

      {(assignedAthletes?.length ?? 0) > 0 ? (
        <section className="mt-10">
          <h2 className="mb-3 text-base font-semibold text-foreground">Monthly session quotas</h2>
          <Card>
            <CardContent className="p-6">
              <SessionQuotaEditor athletes={assignedAthletes ?? []} subscriptions={assignedSubs} />
            </CardContent>
          </Card>
        </section>
      ) : null}

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
                              Last: {formatHkDate(a.last_feedback_at)}
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
                          Last: {formatHkDate(a.last_feedback_at)}
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
