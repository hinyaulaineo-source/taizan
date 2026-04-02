import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'
import { EmptyWorkoutState } from '@/components/ui/empty-workout-state'
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav'
import PersonalBestForm from './PersonalBestForm'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url, main_events')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  const { data: bookings } = await supabase
    .from('bookings')
    .select('*, sessions(*)')
    .eq('athlete_id', user.id)
    .eq('status', 'booked')
    .order('booked_at', { ascending: false })

  const { data: feedback } = await supabase
    .from('feedback')
    .select('*, sessions(title, scheduled_at)')
    .eq('athlete_id', user.id)
    .order('created_at', { ascending: false })

  const { data: availableSessions } = await supabase
    .from('sessions')
    .select('*, programs(*)')
    .eq('status', 'published')
    .order('scheduled_at', { ascending: true })

  const { data: personalBests } = await supabase
    .from('personal_bests')
    .select('id, metric, value, unit, recorded_at')
    .eq('athlete_id', user.id)
    .order('recorded_at', { ascending: true })

  const subscriptionActive =
    !ownerPreview && subscription?.status === 'active' && !!subscription?.tier
  const eligibleAvailableSessions = ownerPreview
    ? (availableSessions ?? [])
    : subscriptionActive
      ? (availableSessions ?? []).filter((s) =>
          ((s.allowed_tiers as unknown as string[]) ?? []).includes(subscription!.tier),
        )
      : []

  const tierLabel = ownerPreview
    ? 'Owner preview'
    : subscription
      ? `${subscription.tier} · ${subscription.status}`
      : 'No subscription'
  const tierTone: 'success' | 'warning' | 'neutral' = ownerPreview
    ? 'neutral'
    : subscription?.status === 'active'
      ? 'success'
      : subscription
        ? 'warning'
        : 'neutral'

  const pbRows = (() => {
    const rows = (personalBests ?? []).map((pb: any) => ({
      id: pb.id,
      metric: pb.metric as string,
      value: Number(pb.value),
      unit: String(pb.unit ?? ''),
      recordedAt: pb.recorded_at as string,
    }))
    return rows.slice(-8)
  })()

  const personalBestValue = pbRows.reduce((best, row) => {
    if (best === null) return row.value
    return Math.min(best, row.value)
  }, null as number | null)

  const latestPb = pbRows.length > 0 ? pbRows[pbRows.length - 1] : null

  const attendanceStats = (() => {
    const now = new Date()
    const d30 = new Date(now)
    d30.setUTCDate(d30.getUTCDate() - 30)
    const d84 = new Date(now)
    d84.setUTCDate(d84.getUTCDate() - 84)

    const in30 = (bookings ?? []).filter((b: any) => {
      const t = new Date((b.sessions as any)?.scheduled_at ?? b.booked_at)
      return !Number.isNaN(t.getTime()) && t >= d30
    }).length

    const in84 = (bookings ?? []).filter((b: any) => {
      const t = new Date((b.sessions as any)?.scheduled_at ?? b.booked_at)
      return !Number.isNaN(t.getTime()) && t >= d84
    }).length

    const weeks = 12
    const attendanceRate = Math.min(100, Math.round((in84 / weeks) * 100))
    return { in30, in84, attendanceRate }
  })()

  return (
    <main className="pb-20 md:pb-0">
      {ownerPreview && (
        <div className="mb-6 rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
          You’re viewing the athlete dashboard as an owner. Session list shows published sessions;
          booking and cancellations are disabled. Sign in as an athlete to test the full flow.
        </div>
      )}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div className="flex items-start gap-4">
          {profile?.avatar_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={profile.avatar_url}
              alt=""
              className="h-14 w-14 shrink-0 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-medium text-foreground">
              {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-foreground">
              Welcome, {profile?.full_name ?? user.email}
            </h1>
            {(profile?.main_events as string[] | undefined)?.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {(profile?.main_events as string[]).map((eventName) => (
                  <span
                    key={eventName}
                    className="rounded-full border border-border bg-muted px-2.5 py-1 text-xs text-foreground"
                  >
                    {eventName}
                  </span>
                ))}
              </div>
            ) : null}
            <p className="mt-1 text-sm text-muted-foreground">Fall 7, get up 8.</p>
          </div>
        </div>
        <Badge tone={tierTone}>{tierLabel}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Booked sessions</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{bookings?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {ownerPreview ? 'Published sessions (preview)' : 'Available sessions'}
            </p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{eligibleAvailableSessions.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-muted-foreground">Feedback received</p>
            <p className="mt-2 text-3xl font-semibold text-foreground">{feedback?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-6 grid gap-3 lg:grid-cols-2">
        <Card>
          <CardContent>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">Personal Best Progression</h2>
              <Badge tone="success">
                PB {personalBestValue !== null ? personalBestValue : '-'}
                {latestPb?.unit ? ` ${latestPb.unit}` : ''}
              </Badge>
            </div>
            {latestPb && (
              <p className="mb-3 text-xs text-muted-foreground">
                Latest: {latestPb.metric} · {latestPb.value} {latestPb.unit}
              </p>
            )}
            {pbRows.length === 0 ? (
              <p className="text-sm text-muted-foreground">No PB records yet. Add your first result below.</p>
            ) : (
              <div className="space-y-2">
                {pbRows.map((row) => {
                  const maxValue = Math.max(...pbRows.map((r) => r.value), 1)
                  const width = Math.max(10, Math.round((row.value / maxValue) * 100))
                  return (
                    <div key={row.id} className="grid grid-cols-[92px_1fr_70px] items-center gap-2">
                      <span className="truncate text-xs text-muted-foreground">{row.metric}</span>
                      <div className="h-2 rounded-full bg-muted">
                        <div className="h-2 rounded-full bg-indigo-500" style={{ width: `${width}%` }} />
                      </div>
                      <span className="text-right text-xs text-foreground">{row.value} {row.unit}</span>
                    </div>
                  )
                })}
              </div>
            )}
            <PersonalBestForm />
          </CardContent>
        </Card>

        <Card>
          <CardContent>
            <h2 className="mb-3 text-sm font-semibold text-foreground">Training Attendance</h2>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Last 30 days</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{attendanceStats.in30}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Last 12 weeks</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{attendanceStats.in84}</p>
              </div>
              <div className="rounded-lg border border-border bg-card p-3">
                <p className="text-xs text-muted-foreground">Attendance</p>
                <p className="mt-1 text-xl font-semibold text-foreground">{attendanceStats.attendanceRate}%</p>
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Attendance is estimated from booked sessions in the last 12 weeks.
            </p>
          </CardContent>
        </Card>
      </section>

      <section className="mt-8">
        <div className="glass-panel min-h-[220px] p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Today's Session</h2>
          {eligibleAvailableSessions.length > 0 ? (
            <>
              <p className="mt-2 text-sm text-foreground">
                {(eligibleAvailableSessions[0] as any).title} ·{' '}
                {new Date((eligibleAvailableSessions[0] as any).scheduled_at).toLocaleString()}
              </p>
              <a href="/dashboard/athlete/book" className="accent-btn mt-6 inline-block">
                Open Session
              </a>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No eligible session yet.</p>
          )}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">Calendar</h2>
        {(() => {
          const bookedSessionIds = new Set<string>((bookings ?? []).map((b: any) => (b.sessions as any)?.id).filter(Boolean))
          const dateKeyFromScheduledAt = (scheduledAt: string) => {
            const d = new Date(scheduledAt)
            const yyyy = d.getFullYear()
            const mm = String(d.getMonth() + 1).padStart(2, '0')
            const dd = String(d.getDate()).padStart(2, '0')
            return `${yyyy}-${mm}-${dd}`
          }

          const events: CalendarEvent[] = []

          // Add eligible sessions first (so available ones show)
          ;(eligibleAvailableSessions ?? []).forEach((s: any) => {
            const isBooked = bookedSessionIds.has(s.id)
            events.push({
              dateKey: dateKeyFromScheduledAt(s.scheduled_at),
              sessionId: s.id,
              title: s.title,
              isBooked,
              canBook: !ownerPreview && subscriptionActive && !isBooked,
              bookHref:
                ownerPreview || isBooked ? undefined : `/dashboard/athlete/book/${s.id}`,
              cancel:
                ownerPreview || !isBooked
                  ? undefined
                  : { href: '/api/bookings/cancel', body: { sessionId: s.id } },
            })
          })

          // Add booked sessions even if they are no longer eligible
          ;(bookings ?? []).forEach((b: any) => {
            const s = b.sessions as any
            if (!s?.id) return
            if ((eligibleAvailableSessions ?? []).some((es: any) => es.id === s.id)) return
            events.push({
              dateKey: dateKeyFromScheduledAt(s.scheduled_at),
              sessionId: s.id,
              title: s.title,
              isBooked: true,
              canBook: false,
              cancel: ownerPreview
                ? undefined
                : { href: '/api/bookings/cancel', body: { sessionId: s.id } },
            })
          })

          return <Calendar events={events} bookingLink="/dashboard/athlete/book" initialMonth={new Date()} />
        })()}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">My bookings</h2>
        {bookings?.length === 0 && (
          <EmptyWorkoutState />
        )}
        {bookings && bookings.length > 0 && (
          <div className="max-h-[380px] space-y-3 overflow-y-auto pr-1">
            {bookings.map((b) => (
              <Card key={b.id} className="mb-3">
                <CardContent>
                  <Link href={`/dashboard/athlete/session/${(b.sessions as any)?.id}`} className="block hover:opacity-90">
                    <p className="text-sm font-semibold text-foreground">{(b.sessions as any)?.title}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {new Date((b.sessions as any)?.scheduled_at).toLocaleDateString()} · {b.status} · Tap for details
                    </p>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">Coach feedback</h2>
        {feedback?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            </CardContent>
          </Card>
        )}
        <div className="space-y-2">
          {feedback?.map((f, idx) => (
            <div
              key={f.id}
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                idx % 2 === 0
                  ? 'bg-accent text-accent-foreground'
                  : 'ml-auto bg-primary text-primary-foreground'
              }`}
            >
              <p className="mb-1 text-[11px] text-muted-foreground">
                {(f.sessions as any)?.title} · {new Date(f.created_at).toLocaleDateString()}
              </p>
              <p>{f.content}</p>
            </div>
          ))}
        </div>
      </section>
      <MobileBottomNav />
    </main>
  )
}