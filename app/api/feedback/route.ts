import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
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

  if (!profile || (profile.role !== 'coach' && !isOwnerLike(profile.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { athleteId, sessionId, content } = (await request.json()) as {
    athleteId?: string
    sessionId?: string | null
    content?: string
  }

  if (!athleteId || !content?.trim()) {
    return NextResponse.json({ error: 'athleteId and content are required.' }, { status: 400 })
  }

  const { error } = await supabase.from('feedback').insert({
    athlete_id: athleteId,
    session_id: sessionId ?? null,
    coach_id: user.id,
    content: content.trim(),
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
