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

  // Verify link
  const { data: link } = await supabase
    .from('parent_athlete_links')
    .select('id')
    .eq('parent_id', user.id)
    .eq('athlete_id', athleteId)
    .single()

  if (!link) {
    return NextResponse.json({ error: 'This athlete is not linked to your parent account.' }, { status: 403 })
  }

  // Fetch athlete subscription for tier gating
  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', athleteId)
    .single()

  if (!subscription || subscription.status !== 'active') {
    return NextResponse.json({ error: 'Athlete needs an active subscription.' }, { status: 403 })
  }

  // Fetch session availability + tier gating
  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, allowed_tiers, max_athletes')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'published') {
    return NextResponse.json({ error: 'Session is not available.' }, { status: 404 })
  }

  const allowedTiers = ((session.allowed_tiers ?? []) as string[]) ?? []
  if (!allowedTiers.includes(subscription.tier)) {
    return NextResponse.json({ error: 'This session is not available for the athlete tier.' }, { status: 403 })
  }

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('athlete_id', athleteId)
    .eq('session_id', sessionId)
    .maybeSingle()

  if (session.max_athletes && !existingBooking) {
    const { count } = await supabase
      .from('bookings')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', session.id)
      .eq('status', 'booked')
    if ((count ?? 0) >= session.max_athletes) {
      return NextResponse.json({ error: 'Session is full.' }, { status: 409 })
    }
  }

  const { error } = await supabase.from('bookings').upsert(
    {
      athlete_id: athleteId,
      session_id: sessionId,
      status: 'booked',
    },
    { onConflict: 'athlete_id,session_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

