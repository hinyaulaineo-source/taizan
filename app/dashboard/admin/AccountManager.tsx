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

export default function AccountManager({ profiles }: { profiles: ProfileRow[] }) {
  const router = useRouter()
  const [savingId, setSavingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string>('')

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
      {profiles.length === 0 ? (
        <p className="text-sm text-muted-foreground">No accounts found.</p>
      ) : (
        <div className="space-y-2">
          {profiles.map((p) => {
            const draftRole = roleDraft.get(p.id) ?? p.role
            return (
              <div key={p.id} className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.full_name ?? 'Unnamed'}</p>
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
                    className="bg-white text-black hover:bg-zinc-200"
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

