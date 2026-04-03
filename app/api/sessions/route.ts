import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, sessionCreateSchema, sessionPatchSchema } from '@/lib/security/validation'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(sessionCreateSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const validated = parsed.data

  const maxAthletes =
    typeof validated.max_athletes === 'number' && Number.isFinite(validated.max_athletes)
      ? Math.max(1, Math.floor(validated.max_athletes))
      : null
  const status = isOwnerLike(profile?.role) ? 'published' : 'pending'

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      title: validated.title,
      session_type: validated.session_type,
      scheduled_at: validated.scheduled_at,
      location: validated.location,
      allowed_tiers: validated.allowed_tiers,
      max_athletes: maxAthletes,
      created_by: user.id,
      status,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
  return NextResponse.json(data)
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (!isOwnerLike(profile?.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(sessionPatchSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { id, status } = parsed.data

  const { data, error } = await supabase
    .from('sessions')
    .update({
      status,
      approved_by: user.id,
      approved_at: status === 'published' ? new Date().toISOString() : null,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: 500 }
    )
  }
  return NextResponse.json(data)
}
