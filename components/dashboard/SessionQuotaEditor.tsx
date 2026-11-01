'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { defaultMonthlySessions, effectiveQuota } from '@/lib/session-quota'

export type QuotaAthlete = {
  id: string
  full_name: string | null
  email: string
}

export type QuotaSubscription = {
  user_id: string
  tier: string
  status: string
  monthly_session_allowance?: number | null
  sessions_remaining?: number | null
  quota_month?: string | null
}

export default function SessionQuotaEditor({
  athletes,
  subscriptions,
  allowRenewAll = false,
}: {
  athletes: QuotaAthlete[]
  subscriptions: QuotaSubscription[]
  allowRenewAll?: boolean
}) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [renewingAll, setRenewingAll] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const subById = useMemo(() => {
    const map = new Map<string, QuotaSubscription>()
    subscriptions.forEach((s) => map.set(s.user_id, s))
    return map
  }, [subscriptions])

  const initial = useMemo(() => {
    const allowance = new Map<string, string>()
    const remaining = new Map<string, string>()
    athletes.forEach((a) => {
      const sub = subById.get(a.id)
      const quota = effectiveQuota(sub)
      allowance.set(a.id, String(quota.allowance))
      remaining.set(a.id, String(quota.remaining))
    })
    return { allowance, remaining }
  }, [athletes, subById])

  const [allowanceDraft, setAllowanceDraft] = useState(initial.allowance)
  const [remainingDraft, setRemainingDraft] = useState(initial.remaining)

  async function saveQuota(athleteId: string, renew = false) {
    const monthlySessionAllowance = Number(allowanceDraft.get(athleteId) ?? '')
    const sessionsRemaining = Number(remainingDraft.get(athleteId) ?? '')
    if (!Number.isInteger(monthlySessionAllowance) || monthlySessionAllowance < 0) {
      setError('Monthly sessions must be a whole number of 0 or more.')
      return
    }
    if (!renew && (!Number.isInteger(sessionsRemaining) || sessionsRemaining < 0)) {
      setError('Remaining sessions must be a whole number of 0 or more.')
      return
    }
    setSavingId(athleteId)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/coach/session-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          athleteId,
          monthlySessionAllowance,
          sessionsRemaining: renew ? undefined : sessionsRemaining,
          renew,
        }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ?? `Failed to save (HTTP ${res.status}).`)
        return
      }
      if (renew) {
        setRemainingDraft((prev) => {
          const n = new Map(prev)
          n.set(athleteId, String(monthlySessionAllowance))
          return n
        })
        setMessage('Quota renewed for this month.')
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  async function renewAll() {
    setRenewingAll(true)
    setError('')
    setMessage('')
    try {
      const res = await fetch('/api/coach/session-quota', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ renewAll: true }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string; renewed?: number } | null
      if (!res.ok) {
        setError(data?.error ?? 'Failed to renew all quotas.')
        return
      }
      setMessage(
        data?.renewed
          ? `Renewed ${data.renewed} athlete${data.renewed === 1 ? '' : 's'} for the new month.`
          : 'Every athlete was already on this month’s quota.',
      )
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setRenewingAll(false)
    }
  }

  if (athletes.length === 0) {
    return <p className="text-sm text-zinc-500">No athletes to show.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Each booking (by the athlete, a parent, or a coach) uses one session. Cancelling a booking this
        month returns it. Remaining resets to the monthly allowance at the start of each month (Hong Kong
        time).
      </p>
      {allowRenewAll ? (
        <Button
          type="button"
          variant="outline"
          onClick={() => void renewAll()}
          disabled={renewingAll}
          className="hover:bg-zinc-200"
        >
          {renewingAll ? 'Renewing…' : 'Renew all due this month'}
        </Button>
      ) : null}
      <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
        {athletes.map((a) => {
          const sub = subById.get(a.id)
          const quota = effectiveQuota(sub)
          const typical = defaultMonthlySessions(sub?.tier)
          return (
            <div
              key={a.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 lg:flex-row lg:items-end lg:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-zinc-100">{a.full_name ?? 'Unnamed'}</p>
                <p className="text-xs text-zinc-500">
                  {a.email}
                  {sub ? ` · ${sub.tier} · ${sub.status}` : ' · no subscription'}
                </p>
                <p className="mt-1 text-xs text-zinc-400">
                  {quota.remaining} of {quota.allowance} left this month
                  {sub ? ` · typical for ${sub.tier}: ${typical}` : ''}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">Monthly</span>
                  <input
                    type="number"
                    min={0}
                    max={62}
                    value={allowanceDraft.get(a.id) ?? String(quota.allowance)}
                    onChange={(e) => {
                      const value = e.target.value
                      setAllowanceDraft((prev) => {
                        const n = new Map(prev)
                        n.set(a.id, value)
                        return n
                      })
                    }}
                    disabled={!sub || savingId === a.id}
                    className="h-9 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-zinc-500">Left</span>
                  <input
                    type="number"
                    min={0}
                    max={62}
                    value={remainingDraft.get(a.id) ?? String(quota.remaining)}
                    onChange={(e) => {
                      const value = e.target.value
                      setRemainingDraft((prev) => {
                        const n = new Map(prev)
                        n.set(a.id, value)
                        return n
                      })
                    }}
                    disabled={!sub || savingId === a.id}
                    className="h-9 w-20 rounded-md border border-zinc-700 bg-zinc-950 px-2 text-sm text-zinc-100"
                  />
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!sub || savingId === a.id}
                  onClick={() => void saveQuota(a.id)}
                  className="hover:bg-zinc-200"
                >
                  {savingId === a.id ? 'Saving…' : 'Save'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!sub || savingId === a.id}
                  onClick={() => void saveQuota(a.id, true)}
                  className="hover:bg-zinc-200"
                >
                  Renew
                </Button>
              </div>
            </div>
          )
        })}
      </div>
      {message ? <p className="text-sm text-emerald-400">{message}</p> : null}
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
