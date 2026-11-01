import { createClient } from '@/lib/supabase/server'
import { isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, sessionQuotaSchema } from '@/lib/security/validation'
import {
  adminEnvMissingResponse,
  createAdminClientOrNull,
} from '@/lib/supabase/admin-helpers'
import {
  currentQuotaMonthISO,
  isQuotaColumnError,
  renewDueSessionQuotas,
  renewOneSessionQuota,
  SESSION_QUOTA_MIGRATION_HINT,
} from '@/lib/session-quota'
import { NextResponse } from 'next/server'

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

  const role = normalizeRole(profile?.role)
  const owner = isOwnerLike(role)
  if (role !== 'coach' && !owner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(sessionQuotaSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  if (parsed.data.renewAll) {
    if (!owner) {
      return NextResponse.json({ error: 'Only the owner can renew every athlete.' }, { status: 403 })
    }
    const result = await renewDueSessionQuotas(admin)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to renew quotas.' }, { status: 500 })
    }
    return NextResponse.json({ ok: true, renewed: result.renewed })
  }

  const { athleteId, monthlySessionAllowance, sessionsRemaining, renew } = parsed.data
  if (!athleteId) {
    return NextResponse.json({ error: 'athleteId is required.' }, { status: 400 })
  }

  const { data: athlete, error: athleteErr } = await admin
    .from('profiles')
    .select('id, role, primary_coach_id')
    .eq('id', athleteId)
    .maybeSingle()

  if (athleteErr) {
    return NextResponse.json({ error: athleteErr.message }, { status: 500 })
  }
  if (!athlete || normalizeRole(athlete.role) !== 'athlete') {
    return NextResponse.json({ error: 'Athlete not found.' }, { status: 404 })
  }
  if (!owner && athlete.primary_coach_id !== user.id) {
    return NextResponse.json({ error: 'This athlete is not assigned to you.' }, { status: 403 })
  }

  if (renew) {
    const result = await renewOneSessionQuota(admin, athleteId)
    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? 'Failed to renew quota.' }, { status: 500 })
    }
  }

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (monthlySessionAllowance !== undefined) {
    patch.monthly_session_allowance = monthlySessionAllowance
    if (sessionsRemaining === undefined && !renew) {
      patch.sessions_remaining = monthlySessionAllowance
      patch.quota_month = currentQuotaMonthISO()
    }
  }
  if (sessionsRemaining !== undefined) {
    patch.sessions_remaining = sessionsRemaining
  }

  if (monthlySessionAllowance !== undefined || sessionsRemaining !== undefined) {
    const { data: updated, error } = await admin
      .from('subscriptions')
      .update(patch)
      .eq('user_id', athleteId)
      .select('user_id')
    if (error) {
      if (isQuotaColumnError(error)) {
        return NextResponse.json(
          { error: `Update failed: ${error.message}`, hint: SESSION_QUOTA_MIGRATION_HINT },
          { status: 503 },
        )
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!updated || updated.length === 0) {
      return NextResponse.json(
        { error: 'This athlete has no subscription yet. Set tier and status first.' },
        { status: 404 },
      )
    }
  }

  return NextResponse.json({ ok: true })
}
