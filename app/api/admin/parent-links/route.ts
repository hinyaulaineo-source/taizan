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

  const { parentId, athleteId } = (await request.json()) as {
    parentId?: string
    athleteId?: string
  }

  if (!parentId || !athleteId) {
    return NextResponse.json({ error: 'parentId and athleteId are required.' }, { status: 400 })
  }

  const { error } = await supabase.from('parent_athlete_links').upsert(
    {
      parent_id: parentId,
      athlete_id: athleteId,
    },
    { onConflict: 'parent_id,athlete_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

