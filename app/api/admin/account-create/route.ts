import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { DEFAULT_COACH_TIER } from '@/lib/coach-tier'
import { findProfilePhoneClash } from '@/lib/profile-phone'
import {
  adminEnvMissingResponse,
  createAdminClientOrNull,
  isCoachTierColumnError,
} from '@/lib/supabase/admin-helpers'
import { normalizePhoneDigits, phoneDigitsToAuthPassword } from '@/lib/phone-auth'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { adminAccountCreateSchema, parseBody } from '@/lib/security/validation'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'admin', user.id)
  if (limited) return limited

  const { data: viewer } = await supabase.from('profiles').select('role').eq('id', user.id).single()

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

  const parsed = parseBody(adminAccountCreateSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { email, fullName, phone: phoneRaw, role } = parsed.data
  const phoneDigits = normalizePhoneDigits(phoneRaw)
  const password = phoneDigitsToAuthPassword(phoneDigits)

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const phoneClash = await findProfilePhoneClash(admin, phoneDigits)
  if (phoneClash) {
    return NextResponse.json({ error: phoneClash }, { status: 409 })
  }

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: fullName,
      phone: phoneDigits,
      desired_role: role,
    },
  })

  if (createErr) {
    const msg = createErr.message.toLowerCase()
    if (msg.includes('already') || msg.includes('duplicate') || msg.includes('exists')) {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 })
    }
    return NextResponse.json({ error: createErr.message }, { status: 500 })
  }

  if (!created.user) {
    return NextResponse.json({ error: 'Failed to create user.' }, { status: 500 })
  }

  const uid = created.user.id

  if (role === 'coach') {
    const profilePayload = {
      id: uid,
      email,
      full_name: fullName,
      phone: phoneDigits,
      role: 'coach' as const,
      coach_request_pending: false,
      coach_requested_at: null as string | null,
      coach_tier: DEFAULT_COACH_TIER,
    }
    const { error: profileErr } = await admin.from('profiles').upsert(profilePayload, { onConflict: 'id' })

    if (profileErr && isCoachTierColumnError(profileErr)) {
      const { coach_tier: _ct, ...withoutTier } = profilePayload
      void _ct
      const { error: retryErr } = await admin.from('profiles').upsert(withoutTier, { onConflict: 'id' })
      if (retryErr) {
        await admin.auth.admin.deleteUser(uid)
        return NextResponse.json(
          { error: `Account created but profile setup failed: ${retryErr.message}` },
          { status: 500 },
        )
      }
    } else if (profileErr) {
      await admin.auth.admin.deleteUser(uid)
      return NextResponse.json(
        { error: `Account created but profile setup failed: ${profileErr.message}` },
        { status: 500 },
      )
    }
  } else {
    const { error: profileErr } = await admin.from('profiles').upsert(
      {
        id: uid,
        email,
        full_name: fullName,
        phone: phoneDigits,
        role,
        coach_request_pending: false,
        coach_requested_at: null,
      },
      { onConflict: 'id' },
    )

    if (profileErr) {
      await admin.auth.admin.deleteUser(uid)
      return NextResponse.json(
        { error: `Account created but profile setup failed: ${profileErr.message}` },
        { status: 500 },
      )
    }
  }

  return NextResponse.json({ ok: true, userId: uid })
}
