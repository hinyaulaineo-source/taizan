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
  primary_coach_id: string | null
}

type CoachOption = { id: string; full_name: string | null; email: string }

const ROLE_OPTIONS = [
  { value: 'athlete', label: 'Athlete' },
  { value: 'parent', label: 'Parent' },
  { value: 'coach', label: 'Coach' },
] as const

type SubRow = { user_id: string; tier: string; status: string }

export default function AccountManager({
  profiles,
  subscriptions = [],
  coaches = [],
}: {
  profiles: ProfileRow[]
  subscriptions?: SubRow[]
  coaches?: CoachOption[]
}) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingNameId, setSavingNameId] = useState<string | null>(null)
  const [savingCoachForId, setSavingCoachForId] = useState<string | null>(null)
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

  const initialNameById = useMemo(() => {
    const map = new Map<string, string>()
    profiles.forEach((p) => map.set(p.id, p.full_name ?? ''))
    return map
  }, [profiles])

  const [nameDraft, setNameDraft] = useState<Map<string, string>>(initialNameById)
  const [committedNames, setCommittedNames] = useState<Map<string, string>>(initialNameById)

  async function updateName(profileId: string, nextName: string) {
    const fullName = nextName.trim()
    if (!fullName) {
      setError('Enter a name.')
      return
    }
    setSavingNameId(profileId)
    setError('')
    try {
      const res = await fetch('/api/admin/account-name', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId, fullName }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ? data.error : `Failed to update name (HTTP ${res.status}).`)
        setSavingNameId(null)
        return
      }
      setNameDraft((prev) => {
        const n = new Map(prev)
        n.set(profileId, fullName)
        return n
      })
      setCommittedNames((prev) => {
        const n = new Map(prev)
        n.set(profileId, fullName)
        return n
      })
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingNameId(null)
    }
  }

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

  async function updatePrimaryCoach(athleteId: string, coachId: string | null) {
    setSavingCoachForId(athleteId)
    setError('')
    try {
      const res = await fetch('/api/admin/athlete-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ athleteId, coachId }),
      })
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) {
        setError(data?.error ? data.error : `Failed to assign coach (HTTP ${res.status}).`)
        setSavingCoachForId(null)
        return
      }
      router.refresh()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSavingCoachForId(null)
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
      <p className="text-sm text-muted-foreground">
        Change a member&apos;s display name, then save. Role and primary coach stay on the same row.
      </p>
      {sortedProfiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts found.</p>
      ) : (
        <div className="max-h-[480px] space-y-2 overflow-y-auto pr-1">
          {sortedProfiles.map((p) => {
            const draftRole = roleDraft.get(p.id) ?? p.role
            const draftName = nameDraft.get(p.id) ?? p.full_name ?? ''
            const savedName = committedNames.get(p.id) ?? p.full_name ?? ''
            const nameDirty = draftName.trim() !== savedName.trim()
            const sub = subByUserId.get(p.id)
            const showCoachAssign = draftRole === 'athlete'
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <label className="sr-only" htmlFor={`account-name-${p.id}`}>
                      Full name
                    </label>
                    <input
                      id={`account-name-${p.id}`}
                      value={draftName}
                      onChange={(e) => {
                        const value = e.target.value
                        setNameDraft((prev) => {
                          const n = new Map(prev)
                          n.set(p.id, value)
                          return n
                        })
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && nameDirty) {
                          e.preventDefault()
                          void updateName(p.id, draftName)
                        }
                      }}
                      placeholder="Unnamed"
                      className="h-9 min-w-[10rem] flex-1 rounded-md border border-border bg-background px-3 text-sm font-semibold text-foreground"
                    />
                    <Button
                      type="button"
                      onClick={() => void updateName(p.id, draftName)}
                      disabled={savingNameId === p.id || !nameDirty || !draftName.trim()}
                      variant="outline"
                      size="sm"
                      className="hover:bg-zinc-200"
                    >
                      {savingNameId === p.id ? 'Saving…' : 'Save name'}
                    </Button>
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
                  {showCoachAssign ? (
                    <div className="mt-2 flex max-w-md flex-col gap-1">
                      <label className="text-[11px] uppercase tracking-wide text-muted-foreground">
                        Primary coach
                      </label>
                      <select
                        className="h-9 rounded-md border border-border bg-background px-3 text-sm text-foreground"
                        value={p.primary_coach_id ?? ''}
                        disabled={savingCoachForId === p.id}
                        onChange={(e) => {
                          const raw = e.target.value
                          void updatePrimaryCoach(p.id, raw === '' ? null : raw)
                        }}
                      >
                        <option value="">Unassigned</option>
                        {coaches.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.full_name?.trim() ? c.full_name : c.email}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
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

