import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import {
  parseBody,
  trainingLogDeleteSchema,
  trainingLogPatchSchema,
  trainingLogSchema,
} from '@/lib/security/validation'

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

  const role = normalizeRole(profile?.role)

  const rawBody = await safeJsonParse(request)
  const parsed = parseBody(trainingLogSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const {
    distanceKm,
    durationSeconds: durationSecondsRaw,
    runningPercent,
    loggedAt: loggedAtRaw,
    note: noteRaw,
  } = parsed.data
  const durationSeconds = Math.round(durationSecondsRaw * 100) / 100
  const loggedAt = loggedAtRaw
    ? new Date(loggedAtRaw).toISOString()
    : new Date().toISOString()

  if (!role || (!isOwnerLike(role) && role !== 'athlete')) {
    return NextResponse.json(
      { error: 'Only athletes, coaches, and owners can add training logs.' },
      { status: 403 },
    )
  }

  const { error } = await supabase.from('training_logs').insert({
    athlete_id: user.id,
    distance_km: distanceKm,
    duration_seconds: durationSeconds,
    running_percent: runningPercent,
    logged_at: loggedAt,
    note: noteRaw?.trim() ? noteRaw.trim() : null,
    created_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function PATCH(request: Request) {
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

  const role = normalizeRole(profile?.role)
  if (!role || (!isOwnerLike(role) && role !== 'athlete')) {
    return NextResponse.json(
      { error: 'Only athletes, coaches, and owners can edit training logs.' },
      { status: 403 },
    )
  }

  const rawBody = await safeJsonParse(request)
  const parsed = parseBody(trainingLogPatchSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const {
    id,
    distanceKm,
    durationSeconds: durationSecondsRaw,
    runningPercent,
    loggedAt: loggedAtRaw,
    note: noteRaw,
  } = parsed.data
  const durationSeconds = Math.round(durationSecondsRaw * 100) / 100

  const loggedAt = loggedAtRaw
    ? new Date(loggedAtRaw).toISOString()
    : new Date().toISOString()

  const { error } = await supabase
    .from('training_logs')
    .update({
      distance_km: distanceKm,
      duration_seconds: durationSeconds,
      running_percent: runningPercent,
      logged_at: loggedAt,
      note: noteRaw?.trim() ? noteRaw.trim() : null,
    })
    .eq('id', id)
    .eq('athlete_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
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

  const role = normalizeRole(profile?.role)
  if (!role || (!isOwnerLike(role) && role !== 'athlete')) {
    return NextResponse.json(
      { error: 'Only athletes, coaches, and owners can delete training logs.' },
      { status: 403 },
    )
  }

  const rawBody = await safeJsonParse(request)
  const parsed = parseBody(trainingLogDeleteSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { id } = parsed.data

  const { data: deleted, error } = await supabase
    .from('training_logs')
    .delete()
    .eq('id', id)
    .eq('athlete_id', user.id)
    .select('id')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!deleted?.length) {
    return NextResponse.json({ error: 'Training log not found.' }, { status: 404 })
  }
  return NextResponse.json({ ok: true })
}
