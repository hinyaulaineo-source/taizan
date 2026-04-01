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

  if (normalizeRole(profile?.role) !== 'parent') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { athleteId, sessionId } = (await request.json()) as {
    athleteId?: string
    sessionId?: string
  }

  if (!athleteId || !sessionId) {
    return NextResponse.json({ error: 'athleteId and sessionId are required.' }, { status: 400 })
  }

  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

