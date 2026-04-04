'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'

type Status = 'present' | 'absent' | 'unmarked'

interface Athlete {
  id: string
  fullName: string
  email: string
  status: Status
}

const STATUS_CYCLE: Status[] = ['present', 'absent', 'unmarked']

export default function AttendanceChecklist({
  sessionId,
  athletes,
}: {
  sessionId: string
  athletes: Athlete[]
}) {
  const router = useRouter()
  const [statuses, setStatuses] = useState<Record<string, Status>>(
    Object.fromEntries(athletes.map((a) => [a.id, a.status])),
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  function cycle(athleteId: string) {
    setStatuses((prev) => {
      const current = prev[athleteId] ?? 'unmarked'
      const idx = STATUS_CYCLE.indexOf(current)
      const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
      return { ...prev, [athleteId]: next }
    })
    setSaved(false)
  }

  function markAll(status: Status) {
    setStatuses(Object.fromEntries(athletes.map((a) => [a.id, status])))
    setSaved(false)
  }

  async function save() {
    setLoading(true)
    setError('')
    setSaved(false)

    const records = athletes
      .filter((a) => statuses[a.id] !== 'unmarked')
      .map((a) => ({
        athleteId: a.id,
        checkedIn: statuses[a.id] === 'present',
      }))

    if (records.length === 0) {
      setLoading(false)
      setSaved(true)
      return
    }

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

  const presentCount = Object.values(statuses).filter((s) => s === 'present').length
  const absentCount = Object.values(statuses).filter((s) => s === 'absent').length

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {presentCount} present · {absentCount} absent · {athletes.length - presentCount - absentCount} unmarked
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => markAll('present')}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            All present
          </button>
          <button
            type="button"
            onClick={() => markAll('absent')}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            All absent
          </button>
          <button
            type="button"
            onClick={() => markAll('unmarked')}
            className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
          >
            Clear all
          </button>
        </div>
      </div>

      <div className="max-h-[420px] space-y-1 overflow-y-auto pr-1">
        {athletes.map((a) => {
          const s = statuses[a.id] ?? 'unmarked'
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => cycle(a.id)}
              className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-left transition hover:bg-accent/50"
            >
              <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold ${
                s === 'present'
                  ? 'bg-emerald-500 text-white'
                  : s === 'absent'
                    ? 'bg-red-500 text-white'
                    : 'border border-border bg-muted text-muted-foreground'
              }`}>
                {s === 'present' ? '✓' : s === 'absent' ? '✕' : ''}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-foreground">{a.fullName}</p>
                <p className="truncate text-xs text-muted-foreground">{a.email}</p>
              </div>
              <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${
                s === 'present'
                  ? 'bg-emerald-900/40 text-emerald-300'
                  : s === 'absent'
                    ? 'bg-red-900/40 text-red-300'
                    : 'bg-zinc-800 text-zinc-500'
              }`}>
                {s === 'present' ? 'Present' : s === 'absent' ? 'Absent' : 'Tap to mark'}
              </span>
            </button>
          )
        })}
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
