import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessAthleteDashboard, isAthleteRole, isOwnerLike } from '@/lib/auth/roles'
import WeekNavigator from './WeekNavigator'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

export default async function AthleteWeeklyViewPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!canAccessAthleteDashboard(profile?.role)) redirect('/dashboard')

  const ownerPreview = isOwnerLike(profile?.role) && !isAthleteRole(profile?.role)

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  const subscriptionActive =
    !ownerPreview && subscription?.status === 'active' && !!subscription?.tier

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

  const startIso = weekStart.toISOString()
  const endIso = weekEnd.toISOString()

  const { data: sessions } = await supabase
    .from('sessions')
    .select('id, title, session_type, location, scheduled_at, max_athletes, description, allowed_tiers, programs(content_md)')
    .eq('status', 'published')
    .gte('scheduled_at', startIso)
    .lte('scheduled_at', endIso)
    .order('scheduled_at', { ascending: true })

  const { data: bookings } = await supabase
    .from('bookings')
    .select('session_id')
    .eq('athlete_id', user.id)
    .eq('status', 'booked')

  const bookedIds = new Set((bookings ?? []).map((b: any) => b.session_id))

  const eligible = ownerPreview
    ? (sessions ?? [])
    : subscriptionActive
      ? (sessions ?? []).filter((s: any) =>
          ((s.allowed_tiers as unknown as string[]) ?? []).includes(subscription!.tier),
        )
      : []

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const grouped: Map<number, any[]> = new Map()
  for (let i = 0; i < 7; i++) grouped.set(i, [])

  for (const s of eligible) {
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
      <Link href="/dashboard/athlete" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Weekly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Browse sessions day by day. Tap a session to view details or book.
      </p>

      <WeekNavigator
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
                    const isBooked = bookedIds.has(s.id)
                    const time = new Date(s.scheduled_at).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })

                    return (
                      <Link
                        key={s.id}
                        href={isBooked ? `/dashboard/athlete/session/${s.id}` : `/dashboard/athlete/book/${s.id}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300">
                          {time}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.session_type}{s.location ? ` · ${s.location}` : ''}
                            {s.max_athletes ? ` · ${s.max_athletes} max` : ''}
                          </p>
                          {s.description ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{s.description}</p>
                          ) : null}
                        </div>
                        {isBooked ? (
                          <span className="shrink-0 rounded-full bg-emerald-900/40 px-2.5 py-1 text-[11px] font-medium text-emerald-300">
                            Booked
                          </span>
                        ) : (
                          <span className="shrink-0 rounded-full bg-indigo-900/30 px-2.5 py-1 text-[11px] font-medium text-indigo-300">
                            Available
                          </span>
                        )}
                      </Link>
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
