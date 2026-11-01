import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parentCancelSchema, parseBody } from '@/lib/security/validation'
import { createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { isBookedInCurrentQuotaMonth, refundSessionQuota } from '@/lib/session-quota'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(profile?.role) !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(parentCancelSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { athleteId, sessionId } = parsed.data

  const { data: existing } = await supabase
    .from('bookings')
    .select('status, booked_at')
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)
    .maybeSingle()

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (existing?.status === 'booked' && isBookedInCurrentQuotaMonth(existing.booked_at)) {
    const admin = createAdminClientOrNull()
    if (admin) {
      await refundSessionQuota(admin, athleteId, 1)
    }
  }

  return NextResponse.json({ ok: true })
}
