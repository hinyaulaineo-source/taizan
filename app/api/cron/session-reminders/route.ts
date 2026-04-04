import { assertCronAuthorized } from '@/lib/cron/verify-cron-request'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'
import { Resend } from 'resend'

export const maxDuration = 60

/**
 * Finds published sessions starting in ~24h for booked athletes and emails reminders.
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: RESEND_API_KEY, RESEND_FROM_EMAIL (e.g. TrackZAN <onboarding@resend.dev>)
 */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request)
  } catch (e) {
    const status = e instanceof Error && 'status' in e ? (e as Error & { status: number }).status : 500
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: status === 401 ? 401 : 500 })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  const resendKey = process.env.RESEND_API_KEY
  const from = process.env.RESEND_FROM_EMAIL
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? ''

  const windowStart = new Date(Date.now() + 23 * 60 * 60 * 1000).toISOString()
  const windowEnd = new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString()

  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: sessions, error: sErr } = await admin
    .from('sessions')
    .select('id, title, scheduled_at, location')
    .eq('status', 'published')
    .gte('scheduled_at', windowStart)
    .lte('scheduled_at', windowEnd)

  if (sErr) {
    return NextResponse.json({ error: sErr.message }, { status: 500 })
  }

  if (!sessions?.length) {
    return NextResponse.json({ ok: true, sessionsInWindow: 0, remindersSent: 0, skippedNoEmailConfig: !resendKey })
  }

  const sessionIds = sessions.map((s) => s.id)
  const sessionById = new Map(sessions.map((s) => [s.id, s]))

  const { data: bookings, error: bErr } = await admin
    .from('bookings')
    .select('session_id, athlete_id')
    .in('session_id', sessionIds)
    .eq('status', 'booked')

  if (bErr) {
    return NextResponse.json({ error: bErr.message }, { status: 500 })
  }

  if (!bookings?.length) {
    return NextResponse.json({ ok: true, sessionsInWindow: sessions.length, remindersSent: 0 })
  }

  const athleteIds = [...new Set(bookings.map((b) => b.athlete_id))]
  const { data: profiles, error: pErr } = await admin
    .from('profiles')
    .select('id, email, full_name')
    .in('id', athleteIds)

  if (pErr) {
    return NextResponse.json({ error: pErr.message }, { status: 500 })
  }

  const profileById = new Map((profiles ?? []).map((p) => [p.id, p]))

  const { data: already } = await admin
    .from('session_reminder_sent')
    .select('session_id, athlete_id')
    .in(
      'session_id',
      sessionIds,
    )

  const sentKey = new Set((already ?? []).map((r) => `${r.session_id}:${r.athlete_id}`))

  const pending: {
    sessionId: string
    athleteId: string
    email: string
    name: string
    title: string
    when: string
    loc: string | null
  }[] = []

  for (const b of bookings) {
    const key = `${b.session_id}:${b.athlete_id}`
    if (sentKey.has(key)) continue
    const prof = profileById.get(b.athlete_id)
    if (!prof?.email) continue
    const sess = sessionById.get(b.session_id)
    if (!sess) continue
    pending.push({
      sessionId: b.session_id,
      athleteId: b.athlete_id,
      email: prof.email,
      name: prof.full_name ?? 'Athlete',
      title: sess.title,
      when: new Date(sess.scheduled_at).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }),
      loc: sess.location,
    })
  }

  if (!resendKey || !from) {
    return NextResponse.json({
      ok: true,
      skippedNoEmailConfig: true,
      sessionsInWindow: sessions.length,
      reminderCandidates: pending.length,
    })
  }

  const resend = new Resend(resendKey)
  let remindersSent = 0
  const errors: string[] = []

  for (const row of pending) {
    const lines = [
      `Hi ${row.name},`,
      ``,
      `Reminder: you are booked for ${row.title} at ${row.when}.`,
      row.loc ? `Location: ${row.loc}` : '',
      site ? `Dashboard: ${site}/dashboard` : '',
    ].filter(Boolean)

    const { error: sendErr } = await resend.emails.send({
      from,
      to: row.email,
      subject: `Reminder: ${row.title}`,
      text: lines.join('\n'),
    })

    if (sendErr) {
      errors.push(`${row.email}: ${sendErr.message}`)
      continue
    }

    const { error: insErr } = await admin.from('session_reminder_sent').insert({
      session_id: row.sessionId,
      athlete_id: row.athleteId,
    })

    if (insErr) {
      errors.push(`${row.email} log: ${insErr.message}`)
      continue
    }

    remindersSent += 1
  }

  return NextResponse.json({
    ok: true,
    sessionsInWindow: sessions.length,
    reminderCandidates: pending.length,
    remindersSent,
    errors: errors.length ? errors : undefined,
  })
}
