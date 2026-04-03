import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { coachRequestSchema, parseBody } from '@/lib/security/validation'

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
  const parsed = parseBody(coachRequestSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { profileId, action } = parsed.data

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

  const newRole = action === 'approve' ? 'coach' : 'athlete'

  const { data: updated, error } = await admin
    .from('profiles')
    .update({ role: newRole, coach_request_pending: false })
    .eq('id', profileId)
    .select('id, role, coach_request_pending')

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
