import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { Badge } from '@/components/ui/badge'
import CoachWeekNavigator from './CoachWeekNavigator'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

export default async function CoachWeeklyViewPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'coach' && !isOwnerLike(profile?.role)) redirect('/dashboard')

  const now = new Date()
  let weekStart: Date
  if (sp.week) {
    weekStart = new Date(sp.week)
    if (Number.isNaN(weekStart.getTime())) weekStart = getMonday(now)
  } else {
    weekStart = getMonday(now)
  }
  const weekEnd = new Date(weekStart)
  weekEnd.setDate(weekEnd.getDate() + 6)
  weekEnd.setHours(23, 59, 59, 999)

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, max_athletes, description, status, allowed_tiers')
    .eq('created_by', user.id)
    .gte('scheduled_at', weekStart.toISOString())
    .lte('scheduled_at', weekEnd.toISOString())
    .order('scheduled_at', { ascending: true })

  const sessionIds = (sessions ?? []).map((s) => s.id)
  const { data: bookings } = sessionIds.length > 0
    ? await supabase
        .from('bookings')
        .select('session_id')
        .in('session_id', sessionIds)
        .eq('status', 'booked')
    : { data: [] as { session_id: string }[] }

  const bookingCountMap = new Map<string, number>()
  for (const b of bookings ?? []) {
    bookingCountMap.set(b.session_id, (bookingCountMap.get(b.session_id) ?? 0) + 1)
  }

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const grouped: Map<number, any[]> = new Map()
  for (let i = 0; i < 7; i++) grouped.set(i, [])

  for (const s of sessions ?? []) {
    const d = new Date(s.scheduled_at)
    const dow = (d.getDay() + 6) % 7
    grouped.get(dow)?.push(s)
  }

  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const fmtDate = (d: Date) =>
    d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <main className="pb-20 md:pb-0">
      <Link href="/dashboard/coach" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to coach dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Weekly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Your sessions at a glance. Tap a session to edit or manage check-in.
      </p>

      <CoachWeekNavigator
        weekStartIso={toDateKey(weekStart)}
        prevWeekIso={toDateKey(prevWeek)}
        nextWeekIso={toDateKey(nextWeek)}
        rangeLabel={`${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`}
      />

      <div className="mt-4 space-y-4">
        {dayLabels.map((label, i) => {
          const daySessions = grouped.get(i) ?? []
          const dayDate = new Date(weekStart)
          dayDate.setDate(dayDate.getDate() + i)
          const isToday = toDateKey(dayDate) === toDateKey(now)

          return (
            <div key={label}>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-semibold ${isToday ? 'text-indigo-400' : 'text-foreground'}`}>
                  {label}
                </h2>
                <span className="text-xs text-muted-foreground">{fmtDate(dayDate)}</span>
                {isToday && (
                  <span className="rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] font-medium text-indigo-300">
                    Today
                  </span>
                )}
              </div>

              {daySessions.length === 0 ? (
                <p className="mt-1 ml-1 text-xs text-muted-foreground">No sessions</p>
              ) : (
                <div className="mt-1.5 space-y-2">
                  {daySessions.map((s: any) => {
                    const booked = bookingCountMap.get(s.id) ?? 0
                    const time = new Date(s.scheduled_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    const statusTone: 'success' | 'warning' | 'neutral' =
                      s.status === 'published' ? 'success' : s.status === 'pending' ? 'warning' : 'neutral'

                    return (
                      <div
                        key={s.id}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300">
                          {time}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.session_type}{s.location ? ` · ${s.location}` : ''}
                            {s.max_athletes ? ` · ${booked}/${s.max_athletes} booked` : ` · ${booked} booked`}
                          </p>
                          {s.description ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{s.description}</p>
                          ) : null}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <Badge tone={statusTone}>{s.status}</Badge>
                          <Link
                            href={`/dashboard/coach/check-in/${s.id}`}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                          >
                            Check-in
                          </Link>
                          <Link
                            href={`/dashboard/coach/edit-session/${s.id}`}
                            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                          >
                            Edit
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </main>
  )
}

function getMonday(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  const monday = new Date(d)
  monday.setDate(diff)
  monday.setHours(0, 0, 0, 0)
  return monday
}

function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
