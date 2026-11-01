import { assertCronAuthorized } from '@/lib/cron/verify-cron-request'
import { createAdminClientOrNull, adminEnvMissingResponse } from '@/lib/supabase/admin-helpers'
import { renewDueSessionQuotas } from '@/lib/session-quota'
import { NextResponse } from 'next/server'

export const maxDuration = 60

/**
 * Resets sessions_remaining to monthly_session_allowance when a new
 * Hong Kong calendar month starts. Lazy renew on booking also covers this.
 *
 * Env: CRON_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request)
  } catch (e) {
    const status = e instanceof Error && 'status' in e ? (e as Error & { status: number }).status : 500
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: status === 401 ? 401 : 500 })
  }

  const admin = createAdminClientOrNull()
  if (!admin) return adminEnvMissingResponse()

  const result = await renewDueSessionQuotas(admin)
  if (!result.ok) {
    return NextResponse.json({ error: result.error ?? 'Renew failed.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true, renewed: result.renewed })
}
