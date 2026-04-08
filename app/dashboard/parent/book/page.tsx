import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessParentDashboard, isOwnerLike, isParentRole } from '@/lib/auth/roles'

type BookRow = {
  key: string
  sessionId: string
  athleteId: string
  title: string
  scheduledAt: string
  location: string | null
  sessionType: string | null
  athleteLabel: string
  isBooked: boolean
}

export default async function ParentBookHubPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role, full_name').eq('id', user.id).single()

  if (!canAccessParentDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isParentRole(profile?.role)

  const { data: links } = await supabase
    .from('parent_athlete_links')
    .select('athlete_id, profiles!parent_athlete_links_athlete_id_fkey(id, full_name, email)')
    .eq('parent_id', user.id)

  const athleteIds = links?.map((l) => l.athlete_id) ?? []

  const { data: subscriptions } =
    athleteIds.length > 0
      ? await supabase.from('subscriptions').select('user_id, tier, status').in('user_id', athleteIds)
      : { data: [] as { user_id: string; tier: string; status: string }[] }

  const { data: bookings } =
    athleteIds.length > 0
      ? await supabase
          .from('bookings')
          .select('session_id, athlete_id')
          .in('athlete_id', athleteIds)
          .eq('status', 'booked')
      : { data: [] as { session_id: string; athlete_id: string }[] }

  const bookedKey = new Set((bookings ?? []).map((b) => `${b.athlete_id}:${b.session_id}`))

  const { data: availableSessions } =
    athleteIds.length > 0 || ownerPreview
      ? await supabase
          .from('sessions')
          .select('id, title, session_type, location, scheduled_at, allowed_tiers, status')
          .eq('status', 'published')
          .order('scheduled_at', { ascending: true })
      : { data: [] }

  const athleteNameById = new Map<string, string>()
  for (const l of links ?? []) {
    const p = l.profiles as { full_name?: string; email?: string } | null
    athleteNameById.set(l.athlete_id, p?.full_name ?? p?.email ?? 'Athlete')
  }

  const subscriptionByAthlete = new Map<string, { tier: string; status: string }>()
  for (const s of subscriptions ?? []) {
    subscriptionByAthlete.set(s.user_id, { tier: s.tier, status: s.status })
  }

  const allowedSessionByTier = (sessionAllowed: unknown, tier: string | null | undefined) => {
    if (!tier) return false
    return ((sessionAllowed ?? []) as string[]).includes(tier)
  }

  const rows: BookRow[] = []

  if (!ownerPreview) {
    for (const s of availableSessions ?? []) {
      for (const athleteId of athleteIds) {
        const sub = subscriptionByAthlete.get(athleteId)
        const eligible = sub?.status === 'active' && allowedSessionByTier(s.allowed_tiers, sub.tier)
        if (!eligible) continue
        const key = `${athleteId}:${s.id}`
        rows.push({
          key,
          sessionId: s.id,
          athleteId,
          title: s.title,
          scheduledAt: s.scheduled_at,
          location: s.location,
          sessionType: s.session_type,
          athleteLabel: athleteNameById.get(athleteId) ?? 'Athlete',
          isBooked: bookedKey.has(key),
        })
      }
    }
  }

  rows.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())

  return (
    <main className="mx-auto max-w-5xl pb-20 md:pb-8">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to parent dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Book sessions</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Choose a session for one of your linked athletes. Each row opens the confirmation screen.
      </p>

      {ownerPreview && (
        <p className="mt-4 rounded-lg border border-amber-900/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Owner preview: links open the booking flow in read-only mode.
        </p>
      )}

      {athleteIds.length === 0 && !ownerPreview && (
        <p className="mt-6 text-sm text-muted-foreground">
          No athletes linked yet. Contact the owner to link an athlete account.
        </p>
      )}

      {athleteIds.length === 0 && ownerPreview && (
        <p className="mt-6 text-sm text-muted-foreground">
          Linked athletes appear here for real parent accounts. Use Parent View with test data to see bookable rows.
        </p>
      )}

      {rows.length === 0 && athleteIds.length > 0 && !ownerPreview && (
        <p className="mt-6 text-sm text-muted-foreground">
          No bookable sessions right now. Check that your athletes have active subscriptions and matching tier access.
        </p>
      )}

      {rows.length > 0 && (
        <ul className="mt-6 space-y-2">
          {rows.map((r) => (
            <li key={r.key}>
              <Link
                href={`/dashboard/parent/book/${r.athleteId}/${r.sessionId}`}
                className="flex flex-col gap-1 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{r.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.athleteLabel}
                    {r.sessionType ? ` · ${r.sessionType}` : ''}
                    {r.location ? ` · ${r.location}` : ''}
                  </p>
                  <p className="mt-0.5 text-xs text-muted-foreground/80">
                    {new Date(r.scheduledAt).toLocaleString('en-GB', {
                      dateStyle: 'medium',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>
                <span
                  className={`shrink-0 self-start rounded-full px-2.5 py-1 text-[11px] font-medium sm:self-center ${
                    r.isBooked
                      ? 'bg-emerald-900/40 text-emerald-300'
                      : 'bg-indigo-900/30 text-indigo-300'
                  }`}
                >
                  {r.isBooked ? 'Booked — view' : 'Book'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </main>
  )
}
