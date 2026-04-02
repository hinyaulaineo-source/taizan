import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'

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

  if (normalizeRole(profile?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = (await request.json().catch(() => null)) as
    | { profileId?: string; role?: string }
    | null

  const profileId = body?.profileId
  const role = normalizeRole(body?.role)

  if (!profileId || !role || !['athlete', 'parent', 'coach'].includes(role)) {
    return NextResponse.json({ error: 'profileId and valid role are required.' }, { status: 400 })
  }

  const updates =
    role === 'coach'
      ? { role: 'coach', coach_request_pending: false, coach_requested_at: null }
      : { role, coach_request_pending: false, coach_requested_at: null }

  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

