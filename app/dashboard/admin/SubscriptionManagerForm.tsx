'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import SessionQuotaEditor, {
  type QuotaSubscription,
} from '@/components/dashboard/SessionQuotaEditor'
import { defaultMonthlySessions } from '@/lib/session-quota'

export default function SubscriptionManagerForm({
  athletes,
  subscriptions,
}: {
  athletes: { id: string; full_name: string | null; email: string }[]
  subscriptions: QuotaSubscription[]
}) {
  type Tier = 'standard' | 'performance_100m' | 'performance_400m' | 'elite' | 'youth_standard' | 'youth_elite'
  const router = useRouter()
  const subscriptionByAthleteId = useMemo(() => {
    const m = new Map<string, QuotaSubscription>()
    subscriptions.forEach((s) => m.set(s.user_id, s))
    return m
  }, [subscriptions])

  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [tier, setTier] = useState<Tier>('standard')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [monthlySessions, setMonthlySessions] = useState(String(defaultMonthlySessions('standard')))
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (athletes[0]?.id) applyAthlete(athletes[0].id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function applyAthlete(nextId: string) {
    setAthleteId(nextId)
    const current = subscriptionByAthleteId.get(nextId)
    if (
      current?.tier === 'standard' ||
      current?.tier === 'performance_100m' ||
      current?.tier === 'performance_400m' ||
      current?.tier === 'elite' ||
      current?.tier === 'youth_standard' ||
      current?.tier === 'youth_elite'
    ) {
      setTier(current.tier as Tier)
      setMonthlySessions(String(current.monthly_session_allowance ?? defaultMonthlySessions(current.tier)))
    } else {
      setMonthlySessions(String(defaultMonthlySessions(tier)))
    }
    if (current?.status === 'active' || current?.status === 'inactive') {
      setStatus(current.status)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Athlete</label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={athleteId}
          onChange={(e) => applyAthlete(e.target.value)}
          disabled={athletes.length === 0}
        >
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.email}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Tier</label>
          <select
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={tier}
            onChange={(e) => {
              const next = e.target.value as Tier
              setTier(next)
              const current = subscriptionByAthleteId.get(athleteId)
              if (!current) setMonthlySessions(String(defaultMonthlySessions(next)))
            }}
          >
            <option value="standard">standard</option>
            <option value="performance_100m">performance 100m</option>
            <option value="performance_400m">performance 400m</option>
            <option value="elite">elite</option>
            <option value="youth_standard">youth standard</option>
            <option value="youth_elite">youth elite</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Status</label>
          <select
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={status}
            onChange={(e) => setStatus(e.target.value as any)}
          >
            <option value="active">active</option>
            <option value="inactive">inactive</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-zinc-400">
            Sessions / month
            <span className="ml-1 text-zinc-600">(typical {defaultMonthlySessions(tier)})</span>
          </label>
          <input
            type="number"
            min={0}
            max={62}
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={monthlySessions}
            onChange={(e) => setMonthlySessions(e.target.value)}
          />
        </div>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button
        onClick={async () => {
          setLoading(true)
          setError('')
          const response = await fetch('/api/admin/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              athleteId,
              tier,
              status,
              monthlySessionAllowance: Number(monthlySessions),
            }),
          })

          if (!response.ok) {
            const data = (await response.json().catch(() => null)) as { error?: string } | null
            setError(data?.error ?? 'Failed to update subscription.')
            setLoading(false)
            return
          }

          router.refresh()
          setLoading(false)
        }}
        disabled={loading || !athleteId || athletes.length === 0}
        className="bg-white text-zinc-800 hover:bg-zinc-200"
      >
        {loading ? 'Saving...' : 'Save subscription'}
      </Button>

      <div className="border-t border-zinc-800 pt-4">
        <h3 className="mb-3 text-sm font-semibold text-zinc-100">Monthly session quotas</h3>
        <SessionQuotaEditor athletes={athletes} subscriptions={subscriptions} allowRenewAll />
      </div>
    </div>
  )
}

