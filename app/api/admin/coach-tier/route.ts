import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import {
  COACH_TIER_MIGRATION_HINT,
  adminDbErrorResponse,
  adminEnvMissingResponse,
  createAdminClientOrNull,
  isCoachTierColumnError,
} from '@/lib/supabase/admin-helpers'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { adminCoachTierSchema, parseBody } from '@/lib/security/validation'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'admin', user.id)
  if (limited) return limited

  const { data: viewer } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(viewer?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(adminCoachTierSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { profileId, coachTier } = parsed.data

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const { data: target, error: readErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', profileId)
    .maybeSingle()

  if (readErr) {
    return adminDbErrorResponse(readErr)
  }
  if (!target) {
    return NextResponse.json({ error: 'Profile not found.' }, { status: 404 })
  }
  if (normalizeRole(target.role) !== 'coach') {
    return NextResponse.json({ error: 'Coach tier applies only to coach accounts.' }, { status: 400 })
  }

  const { data: updated, error: updErr } = await admin
    .from('profiles')
    .update({ coach_tier: coachTier })
    .eq('id', profileId)
    .select('id, coach_tier')
    .maybeSingle()

  if (updErr) {
    if (isCoachTierColumnError(updErr)) {
      return NextResponse.json({ error: `Update failed: ${updErr.message}`, hint: COACH_TIER_MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: `Update failed: ${updErr.message}` }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Update returned no row.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated })
}
