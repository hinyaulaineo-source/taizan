import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import MonthNavigator from '@/components/dashboard/MonthNavigator'
import MonthCalendarGrid, { type MonthGridEvent } from '@/components/dashboard/MonthCalendarGrid'
import {
  daysInMonthKey,
  formatHkTime,
  hkDateParts,
  monthLabel,
  parseMonthKey,
  shiftMonthKey,
  monthRangeIso,
} from '@/lib/hk-date'

interface PageProps {
  searchParams: Promise<{ month?: string }>
}

export default async function CoachMonthlyViewPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const monthKey = parseMonthKey(sp.month)
  const { startIso, endIso } = monthRangeIso(monthKey)
  const todayKey = hkDateParts(new Date()).dateKey
  const dayCount = daysInMonthKey(monthKey)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, max_athletes, description, status, allowed_tiers')
    .eq('created_by', user.id)
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })

  const eventsByDay = new Map<number, MonthGridEvent[]>()
  for (let day = 1; day <= dayCount; day++) eventsByDay.set(day, [])

  for (const s of sessions ?? []) {
    const day = Number(hkDateParts(s.scheduled_at).day)
    const tone =
      s.status === 'published' ? 'published' : s.status === 'pending' ? 'pending' : 'neutral'
    eventsByDay.get(day)?.push({
      id: s.id,
      href: `/dashboard/coach/edit-session/${s.id}`,
      timeLabel: formatHkTime(s.scheduled_at),
      title: s.title,
      tone,
    })
  }

  return (
    <main className="pb-20 md:pb-0">
      <Link href="/dashboard/coach" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to coach dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Monthly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Master month view of your sessions. Tap a session to edit.
      </p>

      <MonthNavigator
        basePath="/dashboard/coach/monthly"
        prevMonthKey={shiftMonthKey(monthKey, -1)}
        nextMonthKey={shiftMonthKey(monthKey, 1)}
        label={monthLabel(monthKey)}
      />

      <MonthCalendarGrid monthKey={monthKey} todayKey={todayKey} eventsByDay={eventsByDay} />
    </main>
  )
}
