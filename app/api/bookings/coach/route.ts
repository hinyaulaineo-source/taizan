import { createClient } from '@/lib/supabase/server'
import { isOwnerLike } from '@/lib/auth/roles'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { coachBookingSchema, coachUnbookSchema, parseBody } from '@/lib/security/validation'
import { NextResponse } from 'next/server'

async function requireCoach(supabase: Awaited<ReturnType<typeof createClient>>, userId: string) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .single()
  return profile?.role === 'coach' || isOwnerLike(profile?.role)
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  if (!(await requireCoach(supabase, user.id))) {
    return NextResponse.json({ error: 'Only coaches and owners can book athletes.' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(coachBookingSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionId, sessionIds: batchIds, athleteIds, bookAllEligible, allowedTiers: overrideTiers } = parsed.data

  const resolvedIds = batchIds && batchIds.length > 0 ? batchIds : [sessionId!]

  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, allowed_tiers, max_athletes')
    .in('id', resolvedIds)

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ error: 'No sessions found.' }, { status: 404 })
  }

  const firstSession = sessions[0]
  const allowedTiers = overrideTiers && overrideTiers.length > 0
    ? overrideTiers
    : (firstSession.allowed_tiers ?? []) as string[]

  let targetAthleteIds: string[]

  if (bookAllEligible) {
    const { data: eligible, error: subErr } = await supabase
      .from('subscriptions')
      .select('user_id, tier, profiles!inner(role)')
      .eq('status', 'active')
      .eq('profiles.role', 'athlete')
      .in('tier', allowedTiers)

    if (subErr) return NextResponse.json({ error: subErr.message }, { status: 500 })
    targetAthleteIds = (eligible ?? []).map((s) => s.user_id)
  } else {
    targetAthleteIds = Array.from(new Set(athleteIds!.filter(Boolean)))
  }

  if (targetAthleteIds.length === 0) {
    return NextResponse.json({ error: 'No eligible athletes found.' }, { status: 400 })
  }

  let totalBooked = 0
  let totalSkipped = 0

  for (const sess of sessions) {
    const { data: existing } = await supabase
      .from('bookings')
      .select('athlete_id')
      .eq('session_id', sess.id)
      .eq('status', 'booked')

    const alreadyBookedSet = new Set((existing ?? []).map((r) => r.athlete_id))
    const newAthletes = targetAthleteIds.filter((id) => !alreadyBookedSet.has(id))

    let toBook = newAthletes
    if (sess.max_athletes) {
      const slotsLeft = Math.max(0, sess.max_athletes - alreadyBookedSet.size)
      toBook = newAthletes.slice(0, slotsLeft)
    }

    if (toBook.length > 0) {
      const rows = toBook.map((athleteId) => ({
        athlete_id: athleteId,
        session_id: sess.id,
        status: 'booked',
      }))
      const { error } = await supabase.from('bookings').upsert(rows, {
        onConflict: 'athlete_id,session_id',
      })
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      totalBooked += toBook.length
    }
    totalSkipped += newAthletes.length - toBook.length
  }

  return NextResponse.json({
    ok: true,
    booked: totalBooked,
    sessions: sessions.length,
    skippedFull: totalSkipped,
    total: targetAthleteIds.length,
  })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  if (!(await requireCoach(supabase, user.id))) {
    return NextResponse.json({ error: 'Only coaches and owners can unbook athletes.' }, { status: 403 })
  }

  const rawBody = await safeJsonParse(request)
  if (rawBody === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  const parsed = parseBody(coachUnbookSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionId, sessionIds: batchIds, athleteIds } = parsed.data

  const resolvedIds = batchIds && batchIds.length > 0 ? batchIds : [sessionId!]

  const { error } = await supabase
    .from('bookings')
    .delete()
    .in('session_id', resolvedIds)
    .in('athlete_id', athleteIds)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true, removed: athleteIds.length, sessions: resolvedIds.length })
}

export async function GET(request: Request) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'api', user.id)
  if (limited) return limited

  if (!(await requireCoach(supabase, user.id))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { searchParams } = new URL(request.url)
  const sessionIdParams = searchParams.getAll('sessionId')
  const tierParams = searchParams.getAll('tier')

  if (sessionIdParams.length === 0) {
    return NextResponse.json({ error: 'sessionId required' }, { status: 400 })
  }

  const { data: sessions, error: sessErr } = await supabase
    .from('sessions')
    .select('id, allowed_tiers')
    .in('id', sessionIdParams)

  if (sessErr) return NextResponse.json({ error: sessErr.message }, { status: 500 })
  if (!sessions || sessions.length === 0) {
    return NextResponse.json({ error: 'No sessions found.' }, { status: 404 })
  }

  const allowedTiers = tierParams.length > 0
    ? tierParams
    : (sessions[0].allowed_tiers ?? []) as string[]

  const totalSessions = sessions.length

  const [subsResult, bookingsResult] = await Promise.all([
    supabase
      .from('subscriptions')
      .select('user_id, tier, profiles!inner(id, full_name, email, role)')
      .eq('status', 'active')
      .eq('profiles.role', 'athlete')
      .in('tier', allowedTiers),
    supabase
      .from('bookings')
      .select('athlete_id, session_id, status')
      .in('session_id', sessionIdParams)
      .eq('status', 'booked'),
  ])

  if (subsResult.error) return NextResponse.json({ error: subsResult.error.message }, { status: 500 })
  if (bookingsResult.error) return NextResponse.json({ error: bookingsResult.error.message }, { status: 500 })

  const bookingCounts = new Map<string, number>()
  ;(bookingsResult.data ?? []).forEach((b) =>
    bookingCounts.set(b.athlete_id, (bookingCounts.get(b.athlete_id) ?? 0) + 1),
  )

  const athletes = (subsResult.data ?? []).map((s) => {
    const p = s.profiles as unknown as { id: string; full_name: string | null; email: string; role: string }
    const count = bookingCounts.get(p.id) ?? 0
    return {
      id: p.id,
      fullName: p.full_name ?? p.email,
      email: p.email,
      tier: s.tier,
      bookedCount: count,
      booked: count === totalSessions,
      partial: count > 0 && count < totalSessions,
    }
  })

  athletes.sort((a, b) => a.fullName.localeCompare(b.fullName))

  return NextResponse.json({
    athletes,
    totalSessions,
    filteredByTiers: allowedTiers,
  })
}
