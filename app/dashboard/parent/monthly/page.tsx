import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessParentDashboard, isOwnerLike, isParentRole } from '@/lib/auth/roles'
import MonthNavigator from '@/components/dashboard/MonthNavigator'
import MonthCalendarGrid, { type MonthGridEvent } from '@/components/dashboard/MonthCalendarGrid'
import {
  daysInMonthKey,
  formatHkTime,
  hkDateParts,
  monthLabel,
  monthRangeIso,
  parseMonthKey,
  shiftMonthKey,
} from '@/lib/hk-date'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

type Row = {
  sessionId: string
  athleteId: string
  title: string
  scheduledAt: string
  isBooked: boolean
}

export default async function ParentMonthlyViewPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

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

  const bookedPair = new Set((bookings ?? []).map((b) => `${b.athlete_id}:${b.session_id}`))

  const monthKey = parseMonthKey(sp.month)
  const { startIso, endIso } = monthRangeIso(monthKey)
  const todayKey = hkDateParts(new Date()).dateKey
  const dayCount = daysInMonthKey(monthKey)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, max_athletes, description, allowed_tiers')
    .eq('status', 'published')
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })

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
    const allowedTiers = (sessionAllowed ?? []) as string[]
    return allowedTiers.includes(tier)
  }

  const rowsByDay = new Map<number, Row[]>()
  for (let day = 1; day <= dayCount; day++) rowsByDay.set(day, [])

  const pushRow = (day: number, row: Row) => {
    rowsByDay.get(day)?.push(row)
  }

  if (!ownerPreview) {
    for (const s of sessions ?? []) {
      for (const athleteId of athleteIds) {
        const sub = subscriptionByAthlete.get(athleteId)
        const eligible = sub?.status === 'active' && allowedSessionByTier(s.allowed_tiers, sub.tier)
        if (!eligible) continue
        const key = `${athleteId}:${s.id}`
        const isBooked = bookedPair.has(key)
        const day = Number(hkDateParts(s.scheduled_at).day)
        pushRow(day, {
          sessionId: s.id,
          athleteId,
          title: `${s.title} · ${athleteNameById.get(athleteId) ?? 'Athlete'}`,
          scheduledAt: s.scheduled_at,
          isBooked,
        })
      }
    }
  }

  for (const b of bookings ?? []) {
    const session = (sessions ?? []).find((x) => x.id === b.session_id)
    if (!session) continue
    const day = Number(hkDateParts(session.scheduled_at).day)
    const dayRows = rowsByDay.get(day) ?? []
    if (dayRows.some((r) => r.sessionId === b.session_id && r.athleteId === b.athlete_id)) continue

    pushRow(day, {
      sessionId: b.session_id,
      athleteId: b.athlete_id,
      title: `${session.title} · ${athleteNameById.get(b.athlete_id) ?? 'Athlete'}`,
      scheduledAt: session.scheduled_at,
      isBooked: true,
    })
  }

  const eventsByDay = new Map<number, MonthGridEvent[]>()
  for (let day = 1; day <= dayCount; day++) {
    const list = rowsByDay.get(day) ?? []
    list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    eventsByDay.set(
      day,
      list.map((s) => ({
        id: `${s.sessionId}-${s.athleteId}`,
        href: `/dashboard/parent/book/${s.athleteId}/${s.sessionId}`,
        timeLabel: formatHkTime(s.scheduledAt),
        title: s.title,
        tone: s.isBooked ? 'booked' : 'available',
      })),
    )
  }

  return (
    <main className="pb-20 md:pb-0">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Monthly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Master month view for your linked athletes. Tap a session to view details or book.
      </p>

      {ownerPreview && (
        <p className="mt-3 rounded-lg border border-amber-900/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Owner preview: booking links stay disabled. Sign in as a parent to book for a linked athlete.
        </p>
      )}

      <MonthNavigator
        basePath="/dashboard/parent/monthly"
        prevMonthKey={shiftMonthKey(monthKey, -1)}
        nextMonthKey={shiftMonthKey(monthKey, 1)}
        label={monthLabel(monthKey)}
      />

      <MonthCalendarGrid monthKey={monthKey} todayKey={todayKey} eventsByDay={eventsByDay} />
    </main>
  )
}
