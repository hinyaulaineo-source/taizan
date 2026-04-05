'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { COACH_TIERS, COACH_TIER_LABELS, type CoachTier } from '@/lib/coach-tier'

type CoachRow = {
  id: string
  full_name: string | null
  email: string
  coach_tier: string | null
}

export default function CoachManager({ coaches }: { coaches: CoachRow[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [error, setError] = useState('')

  async function saveTier(profileId: string, coachTier: CoachTier) {
    setSavingId(profileId)
    setError('')
    try {
      const res = await fetch('/api/admin/coach-tier', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, coachTier }),
      })
      const data = (await res.json().catch(() => null)) as {
        error?: string
        detail?: string
        hint?: string
      } | null
      if (!res.ok) {
        const parts = [
          data?.error ?? `Failed to save tier (HTTP ${res.status}).`,
          data?.detail && data.detail !== data?.error ? data.detail : null,
          data?.hint ?? null,
        ].filter(Boolean)
        setError(parts.join(' '))
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  if (coaches.length === 0) {
    return <p className="text-sm text-zinc-500">No coaches yet. Approve coach requests or promote accounts below.</p>
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-400">
        Set each coach&apos;s tier: senior coach, coach assistant, or junior coach. Athletes can still be assigned to
        any coach from Manage accounts.
      </p>
      <div className="max-h-[420px] space-y-2 overflow-y-auto pr-1">
        {coaches.map((c) => {
          const resolved =
            c.coach_tier && COACH_TIERS.includes(c.coach_tier as CoachTier) ? c.coach_tier : ''
          return (
            <div
              key={c.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-800 bg-zinc-950/50 p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-zinc-100">{c.full_name ?? 'Unnamed'}</p>
                <p className="text-xs text-zinc-500">{c.email}</p>
              </div>
              <label className="flex shrink-0 flex-col gap-1 sm:items-end">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">Tier</span>
                <select
                  className="h-9 min-w-[11rem] rounded-md border border-zinc-700 bg-zinc-950 px-3 text-sm text-zinc-100"
                  value={resolved}
                  disabled={savingId === c.id}
                  onChange={(e) => {
                    const next = e.target.value as CoachTier
                    if (!next || next === resolved) return
                    void saveTier(c.id, next)
                  }}
                >
                  <option value="" disabled>
                    Choose tier…
                  </option>
                  {COACH_TIERS.map((t) => (
                    <option key={t} value={t}>
                      {COACH_TIER_LABELS[t]}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          )
        })}
      </div>
      {error ? <p className="text-sm text-red-400">{error}</p> : null}
    </div>
  )
}
