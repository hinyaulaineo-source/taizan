'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type ProfileRow = {
  id: string
  full_name: string | null
  email: string
  role: string
  coach_request_pending: boolean
}

const ROLE_OPTIONS = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
] as const

type SubRow = { user_id: string; tier: string; status: string }

export default function AccountManager({
  profiles,
  subscriptions = [],
}: {
  profiles: ProfileRow[]
  subscriptions?: SubRow[]
}) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

  const subByUserId = useMemo(() => {
    const map = new Map<string, { tier: string; status: string }>()
    subscriptions.forEach((s) => map.set(s.user_id, { tier: s.tier, status: s.status }))
    return map
  }, [subscriptions])

  const TIER_SORT: Record<string, number> = {
    elite: 1, performance_100m: 2, performance_400m: 3,
    standard: 4, youth_elite: 5, youth_standard: 6,
  }

  const sortedProfiles = useMemo(() =>
    [...profiles].sort((a, b) => {
      const aOrder = TIER_SORT[subByUserId.get(a.id)?.tier ?? ''] ?? 99
      const bOrder = TIER_SORT[subByUserId.get(b.id)?.tier ?? ''] ?? 99
      if (aOrder !== bOrder) return aOrder - bOrder
      return (a.full_name ?? '').localeCompare(b.full_name ?? '')
    }),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  [profiles, subByUserId])

  const initialById = useMemo(() => {
    const map = new Map<string, string>()
    profiles.forEach((p) => map.set(p.id, p.role))
    return map
  }, [profiles])

  const [roleDraft, setRoleDraft] = useState<Map<string, string>>(initialById)

  async function updateRole(profileId: string, nextRole: string) {
    setSavingId(profileId)
    setError('')
    try {
      const res = await fetch('/api/admin/account-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, role: nextRole }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ? data.error : `Failed to update identity (HTTP ${res.status}).`)
        setSavingId(null)
        return
      }
      setRoleDraft((prev) => {
        const n = new Map(prev)
        n.set(profileId, nextRole)
        return n
      })
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingId(null)
    }
  }

  async function deleteAccount(profileId: string) {
    if (!window.confirm('Delete this account? This cannot be undone.')) return
    setDeletingId(profileId)
    setError('')
    try {
      const res = await fetch('/api/admin/account-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ? data.error : `Failed to delete account (HTTP ${res.status}).`)
        setDeletingId(null)
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      {sortedProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts found.</p>
      ) : (
        <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {sortedProfiles.map((p) => {
            const draftRole = roleDraft.get(p.id) ?? p.role
            const sub = subByUserId.get(p.id)
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-semibold text-foreground">{p.full_name ?? 'Unnamed'}</p>
                    {sub && (
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        sub.status === 'active'
                          ? 'bg-emerald-900/40 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}>
                        {sub.tier}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{p.email}</p>
                  {p.coach_request_pending && (
                    <p className="mt-1 text-xs text-muted-foreground">Coach request pending</p>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                    value={draftRole}
                    onChange={(e) => {
                      const nextRole = e.target.value
                      setRoleDraft((prev) => {
                        const n = new Map(prev)
                        n.set(p.id, nextRole)
                        return n
                      })
                    }}
                  >
                    {ROLE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    onClick={() => updateRole(p.id, draftRole)}
                    disabled={savingId === p.id}
                    variant="outline"
                    className="hover:bg-zinc-200"
                  >
                    {savingId === p.id ? 'Saving…' : 'Save'}
                  </Button>
                  <Button
                    onClick={() => deleteAccount(p.id)}
                    disabled={deletingId === p.id}
                    variant="outline"
                    className="border-destructive text-destructive hover:bg-destructive/10"
                  >
                    {deletingId === p.id ? 'Deleting…' : 'Delete'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  )
}

