import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { apiLimiter, rateLimit } from '@/lib/security/rate-limit'
import { attendanceSelfSchema, parseBody } from '@/lib/security/validation'

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
  if (role !== 'athlete' && role !== 'owner') {
    return NextResponse.json({ error: 'Only athletes can self check-in.' }, { status: 403 })
  }

  const body = await request.json().catch(() => null)
  const parsed = parseBody(attendanceSelfSchema, body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { sessionId, checkedIn } = parsed.data

  const { data: booking } = await supabase
    .from('bookings')
    .select('id')
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)
    .eq('status', 'booked')
    .maybeSingle()

  if (!booking) {
    return NextResponse.json({ error: 'You must be booked into this session to check in.' }, { status: 403 })
  }

  const { error } = await supabase
    .from('attendance')
    .upsert({
      session_id: sessionId,
      athlete_id: user.id,
      checked_in: checkedIn,
      marked_by: user.id,
      marked_at: new Date().toISOString(),
    }, { onConflict: 'session_id,athlete_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
