import { createClient } from '@/lib/supabase/server'
import { isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

type Payload = {
  title?: string
  session_type?: string
  start_at?: string
  end_date?: string
  location?: string
  allowed_tiers?: string[]
  weekdays?: number[]
  program?: string
  max_athletes?: number | null
}

function toIsoForLocalDate(localDate: string, hh: number, mm: number) {
  const [y, m, d] = localDate.split('-').map(Number)
  return new Date(y, m - 1, d, hh, mm, 0).toISOString()
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  const role = normalizeRole(profile?.role)
  if (role !== 'coach' && !isOwnerLike(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json()) as Payload
  const {
    title,
    session_type = 'track_session',
    start_at,
    end_date,
    location = '',
    allowed_tiers = ['standard', 'performance', 'elite', 'youth_standard', 'youth_elite'],
    weekdays,
    program = '',
    max_athletes,
  } = body

  if (!title || !start_at || !end_date) {
    return NextResponse.json({ error: 'title, start_at, end_date are required.' }, { status: 400 })
  }

  const startDate = new Date(start_at)
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json({ error: 'Invalid start_at.' }, { status: 400 })
  }
  const [endY, endM, endD] = end_date.split('-').map(Number)
  const endDate = new Date(endY, endM - 1, endD, 23, 59, 59, 999)
  if (Number.isNaN(endDate.getTime())) {
    return NextResponse.json({ error: 'Invalid end_date.' }, { status: 400 })
  }
  const minEnd = new Date(startDate.getTime() + 28 * 24 * 60 * 60 * 1000)
  if (endDate < minEnd) {
    return NextResponse.json(
      { error: 'Recurring sessions must span at least 1 month (28 days).' },
      { status: 400 },
    )
  }

  const selectedWeekdays =
    weekdays && weekdays.length > 0 ? new Set(weekdays) : new Set([startDate.getDay()])
  const hh = startDate.getHours()
  const mm = startDate.getMinutes()

  const cursor = new Date(startDate)
  cursor.setHours(0, 0, 0, 0)
  const startDay = new Date(startDate)
  startDay.setHours(0, 0, 0, 0)

  const rows: {
    title: string
    session_type: string
    scheduled_at: string
    location: string
    allowed_tiers: string[]
    created_by: string
    status: string
    max_athletes: number | null
  }[] = []

  while (cursor <= endDate) {
    const isAfterStart = cursor >= startDay
    if (isAfterStart && selectedWeekdays.has(cursor.getDay())) {
      const localDay = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}-${String(
        cursor.getDate(),
      ).padStart(2, '0')}`
      rows.push({
        title,
        session_type,
        scheduled_at: toIsoForLocalDate(localDay, hh, mm),
        location,
        allowed_tiers,
        created_by: user.id,
        status: isOwnerLike(role) ? 'published' : 'pending',
        max_athletes:
          typeof max_athletes === 'number' && Number.isFinite(max_athletes)
            ? Math.max(1, Math.floor(max_athletes))
            : null,
      })
    }
    cursor.setDate(cursor.getDate() + 1)
  }

  if (rows.length === 0) {
    return NextResponse.json({ error: 'No session dates generated.' }, { status: 400 })
  }
  if (rows.length > 120) {
    return NextResponse.json({ error: 'Too many generated sessions. Reduce range/weekdays.' }, { status: 400 })
  }

  const { data: inserted, error } = await supabase.from('sessions').insert(rows).select('id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (program.trim() && inserted?.length) {
    const programs = inserted.map((s) => ({
      session_id: s.id,
      content_md: program.trim(),
      created_by: user.id,
    }))
    const { error: pError } = await supabase.from('programs').insert(programs)
    if (pError) return NextResponse.json({ error: pError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, created: inserted?.length ?? 0 })
}
