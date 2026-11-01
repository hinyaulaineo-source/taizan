import { createClient } from '@/lib/supabase/server'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { bulkBookingSchema, parseBody } from '@/lib/security/validation'
import { adminEnvMissingResponse, createAdminClientOrNull } from '@/lib/supabase/admin-helpers'
import { consumeSessionQuota, refundSessionQuota } from '@/lib/session-quota'
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
  const parsed = parseBody(bulkBookingSchema, rawBody)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { sessionIds } = parsed.data

  const normalizedIds = Array.from(new Set(sessionIds.filter(Boolean)))
  if (normalizedIds.length === 0) {
    return NextResponse.json({ error: 'No valid session ids provided.' }, { status: 400 })
  }

  const { data: subscription } = await supabase
    .from('subscriptions')
    .select('tier, status')
    .eq('user_id', user.id)
    .single()

  if (!subscription || subscription.status !== 'active') {
    return NextResponse.json({ error: 'Active subscription required.' }, { status: 403 })
  }

  const { data: sessions, error: sessionsError } = await supabase
    .from('sessions')
    .select('id, status, allowed_tiers, max_athletes')
    .in('id', normalizedIds)

  if (sessionsError) return NextResponse.json({ error: sessionsError.message }, { status: 500 })

  const tierEligible = (sessions ?? []).filter((s) => {
    const allowedTiers = (s.allowed_tiers ?? []) as string[]
    return s.status === 'published' && allowedTiers.includes(subscription.tier)
  })

  if (tierEligible.length === 0) {
    return NextResponse.json({ error: 'No eligible sessions found.' }, { status: 400 })
  }

  const eligibleIds = tierEligible.map((s) => s.id)
  const { data: existingForAthlete } = await supabase
    .from('bookings')
    .select('session_id')
    .eq('athlete_id', user.id)
    .in('session_id', eligibleIds)
    .eq('status', 'booked')
  const alreadyBookedIds = new Set((existingForAthlete ?? []).map((r) => r.session_id))

  const { data: allBookedRows } = await supabase
    .from('bookings')
    .select('session_id')
    .in('session_id', eligibleIds)
    .eq('status', 'booked')
  const bookedCountBySession = new Map<string, number>()
  ;(allBookedRows ?? []).forEach((r) =>
    bookedCountBySession.set(r.session_id, (bookedCountBySession.get(r.session_id) ?? 0) + 1),
  )

  const eligible = tierEligible.filter((s) => {
    if (alreadyBookedIds.has(s.id)) return false
    if (!s.max_athletes) return true
    const booked = bookedCountBySession.get(s.id) ?? 0
    return booked < s.max_athletes
  })

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const bookedRows: { athlete_id: string; session_id: string; status: string }[] = []
  let skippedQuota = 0
  for (const s of eligible) {
    const consumed = await consumeSessionQuota(admin, user.id, 1)
    if (!consumed.ok) {
      skippedQuota += eligible.length - bookedRows.length
      break
    }
    bookedRows.push({
      athlete_id: user.id,
      session_id: s.id,
      status: 'booked',
    })
  }

  if (bookedRows.length === 0) {
    return NextResponse.json({
      ok: true,
      requested: normalizedIds.length,
      booked: alreadyBookedIds.size,
      skipped: normalizedIds.length - alreadyBookedIds.size,
      skippedQuota,
    })
  }

  const { error } = await supabase.from('bookings').upsert(bookedRows, {
    onConflict: 'athlete_id,session_id',
  })
  if (error) {
    await refundSessionQuota(admin, user.id, bookedRows.length)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    ok: true,
    requested: normalizedIds.length,
    booked: alreadyBookedIds.size + bookedRows.length,
    skipped: normalizedIds.length - alreadyBookedIds.size - bookedRows.length,
    skippedQuota,
  })
}
