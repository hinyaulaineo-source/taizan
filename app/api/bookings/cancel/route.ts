import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { sessionId } = (await request.json()) as { sessionId?: string }
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })

  // Update existing booking to cancelled (re-booking is allowed due to upsert on athlete_id+session_id).
  const { error } = await supabase
    .from('bookings')
    .update({ status: 'cancelled' })
    .eq('athlete_id', user.id)
    .eq('session_id', sessionId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}

