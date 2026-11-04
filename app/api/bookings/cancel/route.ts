import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { cancelBookingSchema, parseBody } from '@/lib/security/validation'
import { createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { isBookedInCurrentQuotaMonth, refundSessionQuota } from '@/lib/session-quota'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const role = normalizeRole(profile?.role)
  if (role !== 'athlete' && role !== 'owner') {
    return NextResponse.json({ error: 'Only athletes or owners can cancel bookings.' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(cancelBookingSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionId } = parsed.data

  const { data: existing } = await supabase
    .from('bookings')
    .select('status, booked_at')
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)
    .maybeSingle()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing?.status === 'booked' && isBookedInCurrentQuotaMonth(existing.booked_at)) {
    const admin = createAdminClientOrNull()
    if (admin) {
      await refundSessionQuota(admin, user.id, 1)
    }
  }

  return NextResponse.json({ ok: true })
}
