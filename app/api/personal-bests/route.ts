import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isOwnerLike, normalizeRole } from '@/lib/auth/roles'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  const body = (await request.json().catch(() => null)) as
    | { metric?: string; value?: number; unit?: string; recordedAt?: string }
    | null

  const metric = String(body?.metric ?? '').trim()
  const valueNum = Number(body?.value)
  const unit = String(body?.unit ?? '').trim() || 's'
  const recordedAt = body?.recordedAt ? new Date(body.recordedAt).toISOString() : new Date().toISOString()

  if (!metric) return NextResponse.json({ error: 'Metric is required.' }, { status: 400 })
  if (!Number.isFinite(valueNum) || valueNum <= 0) {
    return NextResponse.json({ error: 'Value must be greater than 0.' }, { status: 400 })
  }
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
