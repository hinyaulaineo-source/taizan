import type { SupabaseClient } from '@supabase/supabase-js'
import { SUBSCRIPTION_TIERS } from '@/lib/security/validation'

export const SESSION_QUOTA_MIGRATION_HINT =
  'Apply supabase/migrations/20261102010000_subscription_session_quota.sql in the Supabase SQL editor (or `supabase db push`).'

export const DEFAULT_MONTHLY_SESSIONS: Record<(typeof SUBSCRIPTION_TIERS)[number], number> = {
  youth_standard: 4,
  youth_elite: 8,
  standard: 8,
  performance_100m: 12,
  performance_400m: 12,
  elite: 16,
}

export const QUOTA_TZ = 'Asia/Hong_Kong'

type QuotaRpc = {
  ok?: boolean
  error?: string
  remaining?: number
  allowance?: number
}

export type SubscriptionQuota = {
  user_id: string
  tier: string
  status: string
  monthly_session_allowance?: number | null
  sessions_remaining?: number | null
  quota_month?: string | null
}

export function defaultMonthlySessions(tier: string | null | undefined): number {
  if (tier && tier in DEFAULT_MONTHLY_SESSIONS) {
    return DEFAULT_MONTHLY_SESSIONS[tier as keyof typeof DEFAULT_MONTHLY_SESSIONS]
  }
  return DEFAULT_MONTHLY_SESSIONS.standard
}

export function currentQuotaMonthISO(now = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(now)
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}-01`
}

export function isBookedInCurrentQuotaMonth(bookedAt: string | null | undefined, now = new Date()): boolean {
  if (!bookedAt) return false
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TZ,
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(bookedAt))
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}-01` === currentQuotaMonthISO(now)
}

export function effectiveQuota(sub: Pick<
  SubscriptionQuota,
  'tier' | 'monthly_session_allowance' | 'sessions_remaining' | 'quota_month'
> | null | undefined) {
  const allowance = sub?.monthly_session_allowance ?? defaultMonthlySessions(sub?.tier)
  const month = currentQuotaMonthISO()
  const stale = !sub?.quota_month || sub.quota_month.slice(0, 7) < month.slice(0, 7)
  const remaining = stale ? allowance : (sub?.sessions_remaining ?? allowance)
  return { allowance, remaining, month, stale }
}

export function isQuotaColumnError(err: { message?: string; code?: string } | null | undefined): boolean {
  const m = (err?.message ?? '').toLowerCase()
  if (
    !m.includes('monthly_session_allowance') &&
    !m.includes('sessions_remaining') &&
    !m.includes('quota_month') &&
    !m.includes('consume_session_quota') &&
    !m.includes('refund_session_quota') &&
    !m.includes('renew_session_quota')
  ) {
    return false
  }
  return (
    m.includes('does not exist') ||
    m.includes('schema cache') ||
    m.includes('could not find') ||
    m.includes('unknown column') ||
    m.includes('undefined function')
  )
}

async function rpcQuota(
  admin: SupabaseClient,
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: boolean; remaining?: number; allowance?: number; error?: string }> {
  const { data, error } = await admin.rpc(fn, args)
  if (error) {
    return {
      ok: false,
      error: isQuotaColumnError(error)
        ? `${error.message} ${SESSION_QUOTA_MIGRATION_HINT}`
        : error.message,
    }
  }
  const payload = (typeof data === 'object' && data !== null ? data : {}) as QuotaRpc
  if (payload.ok === false) {
    return {
      ok: false,
      remaining: payload.remaining,
      allowance: payload.allowance,
      error: payload.error ?? 'Session quota update failed.',
    }
  }
  return {
    ok: true,
    remaining: payload.remaining,
    allowance: payload.allowance,
  }
}

export function consumeSessionQuota(admin: SupabaseClient, athleteId: string, count = 1) {
  return rpcQuota(admin, 'consume_session_quota', { p_athlete_id: athleteId, p_count: count })
}

export function refundSessionQuota(admin: SupabaseClient, athleteId: string, count = 1) {
  return rpcQuota(admin, 'refund_session_quota', { p_athlete_id: athleteId, p_count: count })
}

export function renewOneSessionQuota(admin: SupabaseClient, athleteId: string) {
  return rpcQuota(admin, 'renew_session_quota', { p_athlete_id: athleteId })
}

export async function renewDueSessionQuotas(admin: SupabaseClient): Promise<{ ok: boolean; renewed: number; error?: string }> {
  const { data, error } = await admin.rpc('renew_session_quotas')
  if (error) {
    return {
      ok: false,
      renewed: 0,
      error: isQuotaColumnError(error)
        ? `${error.message} ${SESSION_QUOTA_MIGRATION_HINT}`
        : error.message,
    }
  }
  return { ok: true, renewed: typeof data === 'number' ? data : 0 }
}
