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

  const { profileId, action } = (await request.json()) as {
    profileId?: string
    action?: 'approve' | 'reject'
  }

  if (!profileId || !action || !['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: 'profileId and valid action are required.' }, { status: 400 })
  }

  const updates =
    action === 'approve'
      ? { role: 'coach', coach_request_pending: false }
      : { role: 'athlete', coach_request_pending: false, coach_requested_at: null }

  const { error } = await supabase.from('profiles').update(updates).eq('id', profileId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
