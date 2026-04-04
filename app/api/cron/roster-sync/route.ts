import { runRosterSyncFromCsvText } from '@/lib/admin/roster-sync'
import { assertCronAuthorized } from '@/lib/cron/verify-cron-request'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

export const maxDuration = 120

/**
 * Scheduled roster import from a published CSV URL (e.g. Google Sheets
 * File → Share → Anyone with link → publish as CSV, or Apps Script).
 *
 * Env: CRON_SECRET, ROSTER_CSV_URL, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 * Optional: ROSTER_CSV_FETCH_HEADERS — JSON object string for fetch headers (e.g. API key).
 */
export async function GET(request: Request) {
  try {
    assertCronAuthorized(request)
  } catch (e) {
    const status = e instanceof Error && 'status' in e ? (e as Error & { status: number }).status : 500
    const msg = e instanceof Error ? e.message : 'Unauthorized'
    return NextResponse.json({ error: msg }, { status: status === 401 ? 401 : 500 })
  }

  const csvUrl = process.env.ROSTER_CSV_URL
  if (!csvUrl?.trim()) {
    return NextResponse.json({
      skipped: true,
      reason: 'ROSTER_CSV_URL is not set',
    })
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    return NextResponse.json({ error: 'Server configuration error.' }, { status: 500 })
  }

  let headers: HeadersInit = { Accept: 'text/csv,text/plain,*/*' }
  const extra = process.env.ROSTER_CSV_FETCH_HEADERS
  if (extra) {
    try {
      headers = { ...headers, ...(JSON.parse(extra) as Record<string, string>) }
    } catch {
      return NextResponse.json({ error: 'Invalid ROSTER_CSV_FETCH_HEADERS JSON.' }, { status: 500 })
    }
  }

  const res = await fetch(csvUrl, { headers, cache: 'no-store' })
  if (!res.ok) {
    return NextResponse.json(
      { error: `CSV fetch failed: ${res.status} ${res.statusText}` },
      { status: 502 },
    )
  }

  const csvText = await res.text()
  const admin = createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  try {
    const result = await runRosterSyncFromCsvText(admin, csvText, { dryRun: false })
    return NextResponse.json({ source: 'cron', ...result })
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Sync failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
