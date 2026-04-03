import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { apiLimiter, rateLimit } from '@/lib/security/rate-limit'
import { attendanceBatchSchema, parseBody } from '@/lib/security/validation'

export async function GET(request: Request) {
  const limited = rateLimit(request, apiLimiter())
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required' }, { status: 400 })

  const { data, error } = await supabase
    .from('attendance')
    .select('id, session_id, athlete_id, checked_in, marked_at')
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data ?? [])
}

export async function POST(request: Request) {
  const limited = rateLimit(request, apiLimiter())
  if (limited) return limited

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (role !== 'owner' && role !== 'coach') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseBody(attendanceBatchSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { sessionId, records } = parsed.data

  const upserts = records.map((r) => ({
    session_id: sessionId,
    athlete_id: r.athleteId,
    checked_in: r.checkedIn,
    marked_by: user.id,
    marked_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('attendance')
    .upsert(upserts, { onConflict: 'session_id,athlete_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, count: upserts.length })
}
