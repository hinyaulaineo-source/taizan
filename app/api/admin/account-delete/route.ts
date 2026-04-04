import { createClient } from '@/lib/supabase/server'
import { normalizeRole } from '@/lib/auth/roles'
import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { applyRateLimit, safeJsonParse } from '@/lib/security/api-handler'
import { accountDeleteSchema, parseBody } from '@/lib/security/validation'

export async function POST(request: Request) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limited = applyRateLimit(request, 'admin', user.id)
  if (limited) return limited

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (normalizeRole(profile?.role) !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const raw = await safeJsonParse(request)
  if (raw === '__TOO_LARGE__') {
    return NextResponse.json({ error: 'Payload too large' }, { status: 413 })
  }
  if (raw === null) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const parsed = parseBody(accountDeleteSchema, raw)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }
  const { profileId } = parsed.data

  if (profileId === user.id) return NextResponse.json({ error: 'You cannot delete your own account.' }, { status: 400 })

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json(
      { error: 'Server configuration error.' },
      { status: 500 },
    )
  }

  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  // Manually remove related rows so the auth.users cascade doesn't choke
  // on the deep FK chain. Service-role client bypasses RLS.

  // Sessions created by this user — need their IDs to clean child tables
  const { data: userSessions } = await admin
    .from('sessions')
    .select('id')
    .eq('created_by', profileId)
  const sessionIds = (userSessions ?? []).map((s) => s.id)

  if (sessionIds.length > 0) {
    await admin.from('attendance').delete().in('session_id', sessionIds)
    await admin.from('bookings').delete().in('session_id', sessionIds)
    await admin.from('feedback').delete().in('session_id', sessionIds)
    await admin.from('programs').delete().in('session_id', sessionIds)
    await admin.from('sessions').delete().in('id', sessionIds)
  }

  // Direct references to this profile
  await admin.from('attendance').delete().or(`athlete_id.eq.${profileId},marked_by.eq.${profileId}`)
  await admin.from('bookings').delete().eq('athlete_id', profileId)
  await admin.from('feedback').delete().or(`athlete_id.eq.${profileId},coach_id.eq.${profileId}`)
  await admin.from('personal_bests').delete().or(`athlete_id.eq.${profileId},created_by.eq.${profileId}`)
  await admin.from('parent_athlete_links').delete().or(`parent_id.eq.${profileId},athlete_id.eq.${profileId}`)
  await admin.from('subscriptions').delete().eq('user_id', profileId)
  await admin.from('programs').delete().eq('created_by', profileId)

  // Null out approved_by references on sessions approved by this user
  await admin.from('sessions').update({ approved_by: null }).eq('approved_by', profileId)

  // Now the profile row and auth user can be cleanly removed
  await admin.from('profiles').delete().eq('id', profileId)

  const { error: authErr } = await admin.auth.admin.deleteUser(profileId)
  if (authErr) {
    return NextResponse.json({ error: `Failed to delete user: ${authErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
