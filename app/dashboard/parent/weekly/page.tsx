import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { canAccessParentDashboard, isOwnerLike, isParentRole } from '@/lib/auth/roles'
import ParentWeekNavigator from './ParentWeekNavigator'

interface PageProps {
  searchParams: Promise<{ week?: string }>
}

type Row = {
  sessionId: string
  athleteId: string
  title: string
  sessionType: string | null
  location: string | null
  scheduledAt: string
  maxAthletes: number | null
  description: string | null
  isBooked: boolean
}

export default async function ParentWeeklyViewPage({ searchParams }: PageProps) {
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
  for (let i = 0; i < 7; i++) rowsByDay.set(i, [])

  const pushRow = (dow: number, row: Row) => {
    rowsByDay.get(dow)?.push(row)
  }

  if (!ownerPreview) {
    for (const s of sessions ?? []) {
      for (const athleteId of athleteIds) {
        const sub = subscriptionByAthlete.get(athleteId)
        const eligible = sub?.status === 'active' && allowedSessionByTier(s.allowed_tiers, sub.tier)
        if (!eligible) continue
        const key = `${athleteId}:${s.id}`
        const isBooked = bookedPair.has(key)
        const d = new Date(s.scheduled_at)
        const dow = (d.getDay() + 6) % 7
        pushRow(dow, {
          sessionId: s.id,
          athleteId,
          title: `${s.title} · ${athleteNameById.get(athleteId) ?? 'Athlete'}`,
          sessionType: s.session_type,
          location: s.location,
          scheduledAt: s.scheduled_at,
          maxAthletes: s.max_athletes,
          description: s.description,
          isBooked,
        })
      }
    }
  }

  for (const b of bookings ?? []) {
    const sid = b.session_id
    const session = (sessions ?? []).find((x) => x.id === sid)
    if (!session) continue
    const d = new Date(session.scheduled_at)
    if (d < weekStart || d > weekEnd) continue
    const dow = (d.getDay() + 6) % 7
    const key = `${b.athlete_id}:${sid}`
    const dayRows = rowsByDay.get(dow) ?? []
    if (dayRows.some((r) => r.sessionId === sid && r.athleteId === b.athlete_id)) continue

    pushRow(dow, {
      sessionId: sid,
      athleteId: b.athlete_id,
      title: `${session.title} · ${athleteNameById.get(b.athlete_id) ?? 'Athlete'}`,
      sessionType: session.session_type,
      location: session.location,
      scheduledAt: session.scheduled_at,
      maxAthletes: session.max_athletes,
      description: session.description,
      isBooked: true,
    })
  }

  for (let i = 0; i < 7; i++) {
    const list = rowsByDay.get(i) ?? []
    list.sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())
    rowsByDay.set(i, list)
  }

  const dayLabels = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
  const prevWeek = new Date(weekStart)
  prevWeek.setDate(prevWeek.getDate() - 7)
  const nextWeek = new Date(weekStart)
  nextWeek.setDate(nextWeek.getDate() + 7)

  const fmtDate = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })

  return (
    <main className="pb-20 md:pb-0">
      <Link href="/dashboard/parent" className="text-sm text-muted-foreground transition hover:text-foreground">
        ← Back to dashboard
      </Link>

      <h1 className="mt-4 text-2xl font-semibold text-foreground">Weekly Schedule</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Sessions for your linked athletes. Tap a row to view details or book.
      </p>

      {ownerPreview && (
        <p className="mt-3 rounded-lg border border-amber-900/80 bg-amber-950/40 px-3 py-2 text-sm text-amber-100/90">
          Owner preview: booking links stay disabled. Sign in as a parent to book for a linked athlete.
        </p>
      )}

      <ParentWeekNavigator
        weekStartIso={toDateKey(weekStart)}
        prevWeekIso={toDateKey(prevWeek)}
        nextWeekIso={toDateKey(nextWeek)}
        rangeLabel={`${fmtDate(weekStart)} – ${fmtDate(weekEnd)}`}
      />

      <div className="mt-4 space-y-4">
        {dayLabels.map((label, i) => {
          const daySessions = rowsByDay.get(i) ?? []
          const dayDate = new Date(weekStart)
          dayDate.setDate(dayDate.getDate() + i)
          const isToday = toDateKey(dayDate) === toDateKey(now)

          return (
            <div key={label}>
              <div className="flex items-center gap-2">
                <h2 className={`text-sm font-semibold ${isToday ? 'text-indigo-400' : 'text-foreground'}`}>{label}</h2>
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
                  {daySessions.map((s) => {
                    const time = new Date(s.scheduledAt).toLocaleTimeString('en-GB', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                    return (
                      <Link
                        key={`${s.sessionId}-${s.athleteId}`}
                        href={`/dashboard/parent/book/${s.athleteId}/${s.sessionId}`}
                        className="flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 transition hover:bg-accent/40"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-indigo-500/15 text-xs font-bold text-indigo-300">
                          {time}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground">{s.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {s.sessionType ?? 'Session'}
                            {s.location ? ` · ${s.location}` : ''}
                            {s.maxAthletes ? ` · ${s.maxAthletes} max` : ''}
                          </p>
                          {s.description ? (
                            <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{s.description}</p>
                          ) : null}
                        </div>
                        {s.isBooked ? (
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
