import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
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

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 },
    )
  }

  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: existing, error: readErr } = await admin
    .from('profiles')
    .select('id, role, coach_request_pending')
    .eq('id', profileId)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json({ error: 'Service configuration error' }, { status: 500 })
  }

  if (!existing) {
    return NextResponse.json(
      { error: `Profile ${profileId} not found (admin SELECT returned null).` },
      { status: 404 },
    )
  }

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ role })
    .eq('id', profileId)
    .select('id, role')

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

  const clearPending = await admin
    .from('profiles')
    .update({ coach_request_pending: false })
    .eq('id', profileId)

  if (clearPending.error) {
    return NextResponse.json(
      { error: `Role updated to ${role} but clearing coach_request_pending failed: ${clearPending.error.message}` },
      { status: 500 },
    )
  }

  return NextResponse.json({ ok: true, updated: updated[0] })
}
