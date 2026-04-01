import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import Link from 'next/link'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'

export default async function AthleteDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name, avatar_url')
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

  return (
    <main>
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
              className="h-14 w-14 shrink-0 rounded-full border border-zinc-700 object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-lg font-medium text-zinc-300">
              {(profile?.full_name || user.email || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className="text-2xl font-semibold text-white">
              Welcome, {profile?.full_name ?? user.email}
            </h1>
            <p className="mt-1 text-sm text-zinc-400">Fall 7, get up 8.</p>
          </div>
        </div>
        <Badge tone={tierTone}>{tierLabel}</Badge>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Booked sessions</p>
            <p className="mt-2 text-3xl font-semibold text-white">{bookings?.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {ownerPreview ? 'Published sessions (preview)' : 'Available sessions'}
            </p>
            <p className="mt-2 text-3xl font-semibold text-white">{eligibleAvailableSessions.length ?? 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent>
            <p className="text-xs text-zinc-500">Feedback received</p>
            <p className="mt-2 text-3xl font-semibold text-white">{feedback?.length ?? 0}</p>
          </CardContent>
        </Card>
      </div>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Calendar</h2>
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
        <h2 className="mb-3 text-base font-semibold text-zinc-100">My bookings</h2>
        {bookings?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No bookings yet.</p>
            </CardContent>
          </Card>
        )}
        {bookings?.map((b) => (
          <Card key={b.id} className="mb-3">
            <CardContent>
              <p className="text-sm font-semibold text-zinc-100">{(b.sessions as any)?.title}</p>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date((b.sessions as any)?.scheduled_at).toLocaleDateString()} · {b.status}
              </p>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Coach feedback</h2>
        {feedback?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-zinc-500">No feedback yet.</p>
            </CardContent>
          </Card>
        )}
        {feedback?.map((f) => (
          <Card key={f.id} className="mb-3">
            <CardContent>
              <p className="text-xs text-zinc-500">
                {(f.sessions as any)?.title} · {new Date(f.created_at).toLocaleDateString()}
              </p>
              <p className="mt-2 text-sm leading-6 text-zinc-100">{f.content}</p>
            </CardContent>
          </Card>
        ))}
      </section>
    </main>
  )
}