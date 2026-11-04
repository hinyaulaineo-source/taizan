import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
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

export default async function AthleteMonthlyViewPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  const subscriptionActive = !ownerPreview && subscription?.status === 'active' && !!subscription?.tier

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

  const { data: bookings } = await supabase
    .from('bookings')
    .select('session_id')
    .eq('athlete_id', user.id)
    .eq('status', 'booked')

  const bookedIds = new Set((bookings ?? []).map((b) => b.session_id))

  const eligible = ownerPreview
    ? (sessions ?? [])
    : subscriptionActive
      ? (sessions ?? []).filter((s) =>
          ((s.allowed_tiers as unknown as string[]) ?? []).includes(subscription!.tier),
        )
      : []

  const eventsByDay = new Map<number, MonthGridEvent[]>()
  for (let day = 1; day <= dayCount; day++) eventsByDay.set(day, [])

  for (const s of eligible) {
    const day = Number(hkDateParts(s.scheduled_at).day)
    const isBooked = bookedIds.has(s.id)
    eventsByDay.get(day)?.push({
      id: s.id,
      // Owners can open any session details (check-in included). Athletes book first when not booked.
      href:
        ownerPreview || isBooked
          ? `/dashboard/athlete/session/${s.id}`
          : `/dashboard/athlete/book/${s.id}`,
      timeLabel: formatHkTime(s.scheduled_at),
      title: s.title,
      tone: isBooked ? 'booked' : 'available',
    })
  }

  return (
    <main className="pb-20 md:pb-0">
      <Link href="/dashboard/athlete" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Monthly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Master month view of training sessions. Tap a session to view details or book.
      </p>

      <MonthNavigator
        basePath="/dashboard/athlete/monthly"
        prevMonthKey={shiftMonthKey(monthKey, -1)}
        nextMonthKey={shiftMonthKey(monthKey, 1)}
        label={monthLabel(monthKey)}
      />

      <MonthCalendarGrid monthKey={monthKey} todayKey={todayKey} eventsByDay={eventsByDay} />
    </main>
  )
}
