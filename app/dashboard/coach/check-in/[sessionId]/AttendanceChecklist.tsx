'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

interface Athlete {
  id: string
  fullName: string
  email: string
  checkedIn: boolean
}

export default function AttendanceChecklist({
  sessionId,
  athletes,
}: {
  sessionId: string
  athletes: Athlete[]
}) {
  const router = useRouter()
  const [checks, setChecks] = useState<Record<string, boolean>>(
    Object.fromEntries(athletes.map((a) => [a.id, a.checkedIn])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function toggle(athleteId: string) {
    setChecks((prev) => ({ ...prev, [athleteId]: !prev[athleteId] }))
    setSaved(false)
  }

  function selectAll() {
    setChecks(Object.fromEntries(athletes.map((a) => [a.id, true])))
    setSaved(false)
  }

  function deselectAll() {
    setChecks(Object.fromEntries(athletes.map((a) => [a.id, false])))
    setSaved(false)
  }

  async function save() {
    setLoading(true)
    setError('')
    setSaved(false)

    const records = athletes.map((a) => ({
      athleteId: a.id,
      checkedIn: checks[a.id] ?? false,
    }))

    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId, records }),
    })

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to save attendance.')
      setLoading(false)
      return
    }

    setLoading(false)
    setSaved(true)
    router.refresh()
  }

  const checkedCount = Object.values(checks).filter(Boolean).length

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {checkedCount} / {athletes.length} checked in
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={selectAll}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            Select all
          </button>
          <button
            type="button"
            onClick={deselectAll}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            Deselect all
          </button>
        </div>
      </div>

      <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {athletes.map((a) => (
          <label
            key={a.id}
            className="flex cursor-pointer items-center gap-3 rounded-lg border border-border px-3 py-2.5 transition hover:bg-accent/50"
          >
            <input
              type="checkbox"
              checked={checks[a.id] ?? false}
              onChange={() => toggle(a.id)}
              className="h-4 w-4 shrink-0 accent-emerald-500"
            />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">{a.fullName}</p>
              <p className="truncate text-xs text-muted-foreground">{a.email}</p>
            </div>
            {checks[a.id] && (
              <span className="shrink-0 rounded-full bg-emerald-900/40 px-2 py-0.5 text-[10px] font-medium text-emerald-300">
                Present
              </span>
            )}
          </label>
        ))}
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}
      {saved && <p className="text-sm text-emerald-400">Attendance saved.</p>}

      <Button
        onClick={save}
        disabled={loading}
        className="w-full bg-white text-zinc-800 hover:bg-zinc-200"
      >
        {loading ? 'Saving...' : 'Save attendance'}
      </Button>
    </div>
  )
}
