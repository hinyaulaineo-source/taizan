import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { cancelBookingSchema, parseBody } from '@/lib/security/validation'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(cancelBookingSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionId } = parsed.data

  // Update existing booking to cancelled (re-booking is allowed due to upsert on athlete_id+session_id).
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
