import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { bookingSchema, parseBody } from '@/lib/security/validation'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'athlete') {
    return NextResponse.json({ error: 'Only athletes can book sessions.' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(bookingSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionId } = parsed.data

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.status !== 'active') {
    return NextResponse.json({ error: 'Active subscription required.' }, { status: 403 })
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, status, allowed_tiers, max_athletes')
    .eq('id', sessionId)
    .single()

  if (!session || session.status !== 'published') {
    return NextResponse.json({ error: 'Session is not available.' }, { status: 404 })
  }

  const allowedTiers = (session.allowed_tiers ?? []) as string[]
  if (!allowedTiers.includes(subscription.tier)) {
    return NextResponse.json({ error: 'This session is not available for your tier.' }, { status: 403 })
  }

  const { data: existingBooking } = await supabase
    .from('bookings')
    .select('id, status')
    .eq('athlete_id', user.id)
    .eq('session_id', session.id)
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
      athlete_id: user.id,
      session_id: session.id,
      status: 'booked',
    },
    { onConflict: 'athlete_id,session_id' },
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
