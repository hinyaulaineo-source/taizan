import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

type PgErr = { message: string; code?: string }

export const COACH_TIER_MIGRATION_HINT =
  'Apply the coach_tier migration (e.g. `supabase db push` or run supabase/migrations/20260405150000_profiles_coach_tier.sql in the Supabase SQL editor).'

export function adminEnvMissingResponse() {
  return NextResponse.json(
    {
      error:
        'Admin API misconfigured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env (or your host’s environment). The service role key is required for owner actions.',
    },
    { status: 500 },
  )
}

export function createAdminClientOrNull() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!url || !key) return null
  return createSupabaseClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

/** True when DB / PostgREST rejects `coach_tier` because the column or enum was not migrated. */
export function isCoachTierColumnError(err: PgErr | null | undefined): boolean {
  const m = (err?.message ?? '').toLowerCase()
  if (!m.includes('coach_tier')) return false
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('unknown column')
  )
}

export function adminDbErrorResponse(err: PgErr, fallback = 'Database request failed.') {
  return NextResponse.json(
    {
      error: fallback,
      detail: err.message ?? 'Unknown error',
      ...(isCoachTierColumnError(err) ? { hint: COACH_TIER_MIGRATION_HINT } : {}),
    },
    { status: 500 },
  )
}
