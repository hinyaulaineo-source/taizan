import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { adminDbErrorResponse, adminEnvMissingResponse, createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { adminAthleteCoachSchema, parseBody } from '@/lib/security/validation'

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
  const parsed = parseBody(adminAthleteCoachSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { athleteId, coachId } = parsed.data

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const { data: athlete, error: athleteErr } = await admin
    .from('profiles')
    .select('id, role')
    .eq('id', athleteId)
    .maybeSingle()

  if (athleteErr) {
    return adminDbErrorResponse(athleteErr)
  }
  if (!athlete) {
    return NextResponse.json({ error: 'Athlete profile not found.' }, { status: 404 })
  }
  if (normalizeRole(athlete.role) !== 'athlete') {
    return NextResponse.json({ error: 'Target user is not an athlete.' }, { status: 400 })
  }

  if (coachId !== null) {
    const { data: coachRow, error: coachErr } = await admin
      .from('profiles')
      .select('id, role')
      .eq('id', coachId)
      .maybeSingle()

    if (coachErr) {
      return adminDbErrorResponse(coachErr)
    }
    if (!coachRow) {
      return NextResponse.json({ error: 'Coach profile not found.' }, { status: 404 })
    }
    const assigneeRole = normalizeRole(coachRow.role)
    if (assigneeRole !== 'coach' && assigneeRole !== 'owner') {
      return NextResponse.json({ error: 'Primary coach must be a coach or owner account.' }, { status: 400 })
    }
  }

  const { data: updated, error: updErr } = await admin
    .from('profiles')
    .update({ primary_coach_id: coachId })
    .eq('id', athleteId)
    .select('id, primary_coach_id')
    .maybeSingle()

  if (updErr) {
    return NextResponse.json({ error: `Update failed: ${updErr.message}` }, { status: 500 })
  }
  if (!updated) {
    return NextResponse.json({ error: 'Update returned no row.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, updated })
}
