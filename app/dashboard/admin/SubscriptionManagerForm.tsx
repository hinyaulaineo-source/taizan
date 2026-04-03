'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function SubscriptionManagerForm({
  athletes,
  subscriptions,
}: {
  athletes: { id: string; full_name: string | null; email: string }[]
  subscriptions: { user_id: string; tier: string; status: string }[]
}) {
  type Tier = 'standard' | 'performance_100m' | 'performance_400m' | 'elite' | 'youth_standard' | 'youth_elite'
  const router = useRouter()
  const subscriptionByAthleteId = useMemo(() => {
    const m = new Map<string, { tier: string; status: string }>()
    subscriptions.forEach((s) => m.set(s.user_id, { tier: s.tier, status: s.status }))
    return m
  }, [subscriptions])

  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [tier, setTier] = useState<Tier>('standard')
  const [status, setStatus] = useState<'active' | 'inactive'>('active')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Athlete</label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={athleteId}
          onChange={(e) => {
            const nextId = e.target.value
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
            }
            if (current?.status === 'active' || current?.status === 'inactive') {
              setStatus(current.status)
            }
          }}
          disabled={athletes.length === 0}
        >
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.email}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-zinc-400">Tier</label>
          <select
            className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
            value={tier}
            onChange={(e) => setTier(e.target.value as any)}
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
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button
        onClick={async () => {
          setLoading(true)
          setError('')
          const response = await fetch('/api/admin/subscriptions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ athleteId, tier, status }),
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
    </div>
  )
}

