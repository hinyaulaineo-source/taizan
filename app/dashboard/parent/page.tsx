import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Card, CardContent } from '@/components/ui/card'
import {
  canAccessParentDashboard,
  isOwnerLike,
  isParentRole,
  normalizeRole,
} from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'
import MobileBottomNav from '@/components/dashboard/mobile-bottom-nav'

export default async function ParentDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, full_name')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!canAccessParentDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isParentRole(profile?.role)

  const { data: links } = await supabase
    .from('parent_athlete_links')
    .select('athlete_id, profiles!parent_athlete_links_athlete_id_fkey(id, full_name, email)')
    .eq('parent_id', user.id)

  const athleteIds = links?.map(l => l.athlete_id) ?? []

  const { data: subscriptions } = athleteIds.length > 0
    ? await supabase
      .from('subscriptions')
      .select('user_id, tier, status')
      .in('user_id', athleteIds)
    : { data: [] }

  const { data: feedback } = athleteIds.length > 0
    ? await supabase
        .from('feedback')
        .select('*, sessions(title, scheduled_at), profiles!feedback_athlete_id_fkey(full_name)')
        .in('athlete_id', athleteIds)
        .order('created_at', { ascending: false })
    : { data: [] }

  const { data: bookings } = athleteIds.length > 0
    ? await supabase
        .from('bookings')
        .select('*, sessions(*), profiles!bookings_athlete_id_fkey(full_name)')
        .in('athlete_id', athleteIds)
        .eq('status', 'booked')
        .order('booked_at', { ascending: false })
    : { data: [] }

  const { data: availableSessions } =
    athleteIds.length > 0 || ownerPreview
      ? await supabase
          .from('sessions')
          .select('*, programs(*)')
          .eq('status', 'published')
          .order('scheduled_at', { ascending: true })
      : { data: [] }

  const firstPublished = (availableSessions ?? [])[0] as any

  return (
    <main className="pb-20 md:pb-0">
      {ownerPreview && (
        <div className="mb-6 rounded-lg border border-amber-900/80 bg-amber-950/40 px-4 py-3 text-sm text-amber-100/90">
          You’re viewing the parent dashboard as an owner. Linked athletes and booking actions appear
          for real parent accounts. Sign in as a parent to test booking for a linked athlete.
        </div>
      )}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-foreground">Parent Dashboard</h1>
          <p className="mt-1 text-sm text-muted-foreground">Welcome, {profile?.full_name ?? user.email}</p>
        </div>
        <Badge tone="neutral">{ownerPreview ? 'Owner preview' : 'Parent'}</Badge>
      </div>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">Your athletes</h2>
        {links?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                {ownerPreview
                  ? 'Parent accounts see athletes the owner has linked to them here.'
                  : 'No athletes linked yet. Contact the owner to link your athlete account.'}
              </p>
            </CardContent>
          </Card>
        )}

        {links?.map((link) => (
          <Card key={link.athlete_id} className="mb-3">
            <CardContent className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-muted text-sm font-medium text-foreground">
                {(link.profiles as any)?.full_name?.charAt(0) ?? '?'}
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">{(link.profiles as any)?.full_name ?? 'Unnamed'}</p>
                <p className="mt-1 text-xs text-muted-foreground">{(link.profiles as any)?.email}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </section>

      <section className="mb-10">
        <h2 className="mb-3 text-base font-semibold text-foreground">Calendar</h2>
        {athleteIds.length === 0 && !ownerPreview && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No athletes linked yet.</p>
            </CardContent>
          </Card>
        )}
        {ownerPreview && athleteIds.length === 0 && (availableSessions?.length ?? 0) > 0 && (
          <Card className="mb-4">
            <CardContent>
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Published sessions (preview)
              </p>
              <ul className="space-y-2 text-sm text-foreground">
                {(availableSessions ?? []).slice(0, 8).map((s: any) => (
                  <li key={s.id}>
                    {s.title}{' '}
                    <span className="text-muted-foreground">
                      · {new Date(s.scheduled_at).toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        <Calendar
          events={(() => {
            const dateKeyFromScheduledAt = (scheduledAt: string) => {
              const d = new Date(scheduledAt)
              const yyyy = d.getFullYear()
              const mm = String(d.getMonth() + 1).padStart(2, '0')
              const dd = String(d.getDate()).padStart(2, '0')
              return `${yyyy}-${mm}-${dd}`
            }

            const athleteNameById = new Map<string, string>()
            ;(links ?? []).forEach((l: any) => {
              athleteNameById.set(l.athlete_id, l.profiles?.full_name ?? l.profiles?.email ?? 'Athlete')
            })

            // Booked lookup: by athleteId+sessionId
            const bookedKey = new Set<string>()
            ;(bookings ?? []).forEach((b: any) => {
              const sid = b.sessions?.id
              if (!sid) return
              bookedKey.add(`${b.athlete_id}:${sid}`)
            })

            const subscriptionActiveByAthleteId = new Map<string, any>()
            ;(subscriptions ?? []).forEach((s: any) => subscriptionActiveByAthleteId.set(s.user_id, s))

            const allowedSessionByTier = (sessionAllowed: any, tier: string | null | undefined) => {
              if (!tier) return false
              const allowedTiers = (sessionAllowed ?? []) as string[]
              return allowedTiers.includes(tier)
            }

            const eventsMap = new Map<string, CalendarEvent>()

            // 1) Add eligible (available) athlete-session pairs.
            ;(availableSessions ?? []).forEach((s: any) => {
              athleteIds.forEach((athleteId: string) => {
                const sub = subscriptionActiveByAthleteId.get(athleteId)
                const eligible =
                  sub?.status === 'active' && allowedSessionByTier(s.allowed_tiers, sub.tier)

                if (!eligible) return

                const key = `${athleteId}:${s.id}`
                const isBooked = bookedKey.has(key)
                eventsMap.set(key, {
                  dateKey: dateKeyFromScheduledAt(s.scheduled_at),
                  sessionId: key,
                  title: `${s.title} · ${athleteNameById.get(athleteId) ?? 'Athlete'}`,
                  isBooked,
                  canBook: !ownerPreview && !isBooked,
                  bookHref:
                    ownerPreview || isBooked
                      ? undefined
                      : `/dashboard/parent/book/${athleteId}/${s.id}`,
                  cancel:
                    ownerPreview || !isBooked
                      ? undefined
                      : { href: '/api/parent-bookings/cancel', body: { athleteId, sessionId: s.id } },
                })
              })
            })

            // 2) Add booked sessions that might no longer be eligible (still show for visibility).
            ;(bookings ?? []).forEach((b: any) => {
              const s = b.sessions
              if (!s?.id) return
              const key = `${b.athlete_id}:${s.id}`
              if (eventsMap.has(key)) return

              eventsMap.set(key, {
                dateKey: dateKeyFromScheduledAt(s.scheduled_at),
                sessionId: key,
                title: `${s.title} · ${athleteNameById.get(b.athlete_id) ?? 'Athlete'}`,
                isBooked: true,
                canBook: false,
                cancel: ownerPreview
                  ? undefined
                  : { href: '/api/parent-bookings/cancel', body: { athleteId: b.athlete_id, sessionId: s.id } },
              })
            })

            return Array.from(eventsMap.values())
          })()}
          bookingLink="/dashboard/parent"
          initialMonth={new Date()}
        />
      </section>

      <section className="mb-10">
        <div className="glass-panel min-h-[190px] p-5">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Today</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Today's Session</h2>
          {firstPublished ? (
            <p className="mt-2 text-sm text-foreground">
              {firstPublished.title} · {new Date(firstPublished.scheduled_at).toLocaleString()}
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">No published sessions yet.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-base font-semibold text-foreground">Coach feedback</h2>
        {feedback?.length === 0 && (
          <Card>
            <CardContent>
              <p className="text-sm text-muted-foreground">No feedback yet.</p>
            </CardContent>
          </Card>
        )}
        <div className="space-y-2">
          {feedback?.map((f: any, idx: number) => (
            <div
              key={f.id}
              className={`max-w-[88%] rounded-2xl px-3 py-2 text-sm ${
                idx % 2 === 0
                  ? 'bg-accent text-accent-foreground'
                  : 'ml-auto bg-primary text-primary-foreground'
              }`}
            >
              <p className="mb-1 text-[11px] text-muted-foreground">
                {f.sessions?.title} · {new Date(f.created_at).toLocaleDateString()}
              </p>
              <p>{f.content}</p>
            </div>
          ))}
        </div>
      </section>
      <MobileBottomNav role="parent" />
    </main>
  )
}
