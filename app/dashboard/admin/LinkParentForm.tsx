'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

export default function LinkParentForm({
  parents,
  athletes,
}: {
  parents: { id: string; full_name: string | null; email: string }[]
  athletes: { id: string; full_name: string | null; email: string }[]
}) {
  const router = useRouter()
  const [parentId, setParentId] = useState(parents[0]?.id ?? '')
  const [athleteId, setAthleteId] = useState(athletes[0]?.id ?? '')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLink() {
    setLoading(true)
    setError('')
    const response = await fetch('/api/admin/parent-links', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ parentId, athleteId }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to link.')
      setLoading(false)
      return
    }

    router.refresh()
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="mb-1 block text-xs text-zinc-400">Parent account</label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={parentId}
          onChange={(e) => setParentId(e.target.value)}
          disabled={parents.length === 0}
        >
          {parents.map((p) => (
            <option key={p.id} value={p.id}>
              {p.full_name ?? p.email}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="mb-1 block text-xs text-zinc-400">Athlete account</label>
        <select
          className="w-full rounded-md border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
          value={athleteId}
          onChange={(e) => setAthleteId(e.target.value)}
          disabled={athletes.length === 0}
        >
          {athletes.map((a) => (
            <option key={a.id} value={a.id}>
              {a.full_name ?? a.email}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-red-300">{error}</p>}

      <Button
        onClick={handleLink}
        disabled={loading || !parentId || !athleteId || parents.length === 0 || athletes.length === 0}
        className="bg-white text-black hover:bg-zinc-200"
      >
        {loading ? 'Linking...' : 'Link parent to athlete'}
      </Button>
    </div>
  )
}

