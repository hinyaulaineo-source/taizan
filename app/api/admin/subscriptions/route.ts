import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { normalizeRole } from '@/lib/auth/roles'

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

  const { athleteId, tier, status } = (await request.json()) as {
    athleteId?: string
    tier?: 'standard' | 'performance' | 'elite' | 'youth_standard' | 'youth_elite' | string
    status?: 'active' | 'inactive' | string
  }

  if (!athleteId || !tier || !status) {
    return NextResponse.json({ error: 'athleteId, tier, and status are required.' }, { status: 400 })
  }

  const { error } = await supabase.from('subscriptions').upsert(
    {
      user_id: athleteId,
      tier,
      status,
    },
    { onConflict: 'user_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

