import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike, normalizeRole } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, personalBestSchema } from '@/lib/security/validation'

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
  const parsed = parseBody(personalBestSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const { metric, value: valueNum, unit: unitRaw, recordedAt: recordedAtRaw } = parsed.data
  const unit = (unitRaw?.trim() || 's')
  const recordedAt = recordedAtRaw
    ? new Date(recordedAtRaw).toISOString()
    : new Date().toISOString()

  if (!role || (!isOwnerLike(role) && role !== 'athlete')) {
    return NextResponse.json({ error: 'Only athletes, coaches, and owners can add PBs.' }, { status: 403 })
  }

  const { error } = await supabase.from('personal_bests').insert({
    athlete_id: user.id,
    metric,
    value: valueNum,
    unit,
    recorded_at: recordedAt,
    created_by: user.id,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
