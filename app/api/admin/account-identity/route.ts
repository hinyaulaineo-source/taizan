import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { DEFAULT_COACH_TIER } from '@/lib/coach-tier'
import {
  adminDbErrorResponse,
  adminEnvMissingResponse,
  createAdminClientOrNull,
  isCoachTierColumnError,
} from '@/lib/supabase/admin-helpers'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { accountIdentitySchema, parseBody } from '@/lib/security/validation'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'admin', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(profile?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(accountIdentitySchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { profileId } = parsed.data
  const role = normalizeRole(parsed.data.role)

  if (!role || !['athlete', 'parent', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'profileId and valid role are required.' }, { status: 400 })
  }

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  let { data: existing, error: readErr } = await admin
    .from('profiles')
    .select('id, role, coach_request_pending, coach_tier')
    .eq('id', profileId)
    .maybeSingle()

  if (readErr && isCoachTierColumnError(readErr)) {
    const retry = await admin
      .from('profiles')
      .select('id, role, coach_request_pending')
      .eq('id', profileId)
      .maybeSingle()
    existing = retry.data ? { ...retry.data, coach_tier: null } : null
    readErr = retry.error
  }

  if (readErr) {
    return adminDbErrorResponse(readErr)
  }

  if (!existing) {
    return NextResponse.json(
      { error: `Profile ${profileId} not found (admin SELECT returned null).` },
      { status: 404 },
    )
  }

  const updatePayload: Record<string, unknown> = {
    role,
    coach_request_pending: false,
  }

  if (role === 'coach' && !(existing as { coach_tier?: string | null }).coach_tier) {
    updatePayload.coach_tier = DEFAULT_COACH_TIER
  } else if (normalizeRole(existing.role) === 'coach' && role !== 'coach') {
    updatePayload.coach_tier = null
  }

  let { data: updated, error } = await admin
    .from('profiles')
    .update(updatePayload)
    .eq('id', profileId)
    .select('id, role')

  if (error && isCoachTierColumnError(error) && 'coach_tier' in updatePayload) {
    const withoutTier = { ...updatePayload }
    delete withoutTier.coach_tier
    ;({ data: updated, error } = await admin
      .from('profiles')
      .update(withoutTier)
      .eq('id', profileId)
      .select('id, role'))
  }

  if (error) {
    return NextResponse.json({ error: `Update failed: ${error.message}` }, { status: 500 })
  }

  if (!updated || updated.length === 0) {
    return NextResponse.json(
      {
        error:
          `Row exists (current role=${existing.role}) but UPDATE returned 0 rows. Update failed unexpectedly.`,
      },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, updated: updated[0] })
}
