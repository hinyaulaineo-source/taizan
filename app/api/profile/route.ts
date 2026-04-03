import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { parseBody, profilePatchSchema } from '@/lib/security/validation'

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

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

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', user.id)
    .select('id, full_name, avatar_url, main_events, email')
    .single()

  if (error) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 })
  }

  return NextResponse.json(data)
}
