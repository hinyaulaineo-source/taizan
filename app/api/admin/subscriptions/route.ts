import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, subscriptionSchema } from '@/lib/security/validation'
import {
  createAdminClientOrNull,
  adminEnvMissingResponse,
} from '@/lib/supabase/admin-helpers'
import {
  defaultMonthlySessions,
  isQuotaColumnError,
  renewOneSessionQuota,
  SESSION_QUOTA_MIGRATION_HINT,
} from '@/lib/session-quota'

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
  const parsed = parseBody(subscriptionSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { athleteId, tier, status, monthlySessionAllowance, sessionsRemaining, renew } = parsed.data

  const payload: Record<string, unknown> = {
    user_id: athleteId,
    tier,
    status,
  }
  if (monthlySessionAllowance !== undefined) {
    payload.monthly_session_allowance = monthlySessionAllowance
  }
  if (sessionsRemaining !== undefined) {
    payload.sessions_remaining = sessionsRemaining
  }
  if (monthlySessionAllowance !== undefined && sessionsRemaining === undefined && !renew) {
    payload.sessions_remaining = monthlySessionAllowance
  }
  if (monthlySessionAllowance === undefined && sessionsRemaining === undefined) {
    const admin = createAdminClientOrNull()
    const existing = admin
      ? await admin.from('subscriptions').select('user_id').eq('user_id', athleteId).maybeSingle()
      : { data: null as { user_id: string } | null }
    if (!existing.data) {
      payload.monthly_session_allowance = defaultMonthlySessions(tier)
      payload.sessions_remaining = defaultMonthlySessions(tier)
    }
  }

  const { error } = await supabase.from('subscriptions').upsert(payload, { onConflict: 'user_id' })

  if (error) {
    if (isQuotaColumnError(error)) {
      return NextResponse.json(
        { error: `Update failed: ${error.message}`, hint: SESSION_QUOTA_MIGRATION_HINT },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (renew) {
    const admin = createAdminClientOrNull()
    if (!admin) return adminEnvMissingResponse()
    const result = await renewOneSessionQuota(admin, athleteId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to renew quota.' }, { status: 500 })
    }
  }

  return NextResponse.json({ ok: true })
}
