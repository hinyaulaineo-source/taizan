import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, profilePatchSchema } from '@/lib/security/validation'

export async function PATCH(
  request: Request,
  context: { params: Promise<{ athleteId: string }> },
) {
  const { athleteId } = await context.params

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: coachProfile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const viewerRole = normalizeRole(coachProfile?.role)
  if (viewerRole !== 'coach' && viewerRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  const parsed = parseBody(profilePatchSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const body = parsed.data
  const updates: Record<string, string | string[] | null> = {}

  if ('full_name' in body) {
    const v = body.full_name
    updates.full_name =
      v === null || v === undefined ? null : typeof v === 'string' ? v.trim() || null : null
  }

  if ('avatar_url' in body) {
    const v = body.avatar_url
    updates.avatar_url =
      v === null || v === undefined ? null : typeof v === 'string' ? v.trim() || null : null
  }

  if ('main_events' in body) {
    const v = body.main_events
    if (Array.isArray(v)) {
      updates.main_events = v
        .map((e) => (typeof e === 'string' ? e.trim() : ''))
        .filter((e) => e.length > 0)
        .slice(0, 12)
    } else {
      updates.main_events = []
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'Nothing to update.' }, { status: 400 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: athlete, error: readErr } = await admin
    .from('profiles')
    .select('id, role, primary_coach_id')
    .eq('id', athleteId)
    .maybeSingle()

  if (readErr) {
    return NextResponse.json({ error: readErr.message }, { status: 500 })
  }
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete not found.' }, { status: 404 })
  }
  if (normalizeRole(athlete.role) !== 'athlete') {
    return NextResponse.json({ error: 'Target is not an athlete.' }, { status: 400 })
  }
  if (viewerRole === 'coach' && athlete.primary_coach_id !== user.id) {
    return NextResponse.json({ error: 'This athlete is not assigned to you.' }, { status: 403 })
  }

  const { data, error } = await admin
    .from('profiles')
    .update(updates)
    .eq('id', athleteId)
    .select('id, full_name, avatar_url, main_events, email')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json(data)
}
