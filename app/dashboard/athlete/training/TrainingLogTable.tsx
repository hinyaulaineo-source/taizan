'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type TrainingRow = {
  id: string
  logged_at: string
  distance_km: number
  duration_seconds: number
  running_percent: number
  note: string | null
}

function isoToDateInput(value: string) {
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return d.toISOString().slice(0, 10)
}

export default function TrainingLogTable({ rows }: { rows: TrainingRow[] }) {
  const router = useRouter()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [distanceMeters, setDistanceMeters] = useState('')
  const [timeSeconds, setTimeSeconds] = useState('')
  const [runningPercent, setRunningPercent] = useState('')
  const [loggedAt, setLoggedAt] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const byId = useMemo(() => new Map(rows.map((r) => [r.id, r])), [rows])

  function beginEdit(id: string) {
    const row = byId.get(id)
    if (!row) return
    setEditingId(id)
    setDistanceMeters(String(Math.round(row.distance_km * 1000)))
    setTimeSeconds(Number(row.duration_seconds).toFixed(2))
    setRunningPercent(String(row.running_percent))
    setLoggedAt(isoToDateInput(row.logged_at))
    setNote(row.note ?? '')
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setError('')
  }

  async function saveEdit() {
    if (!editingId) return
    const distMeters = Number(distanceMeters)
    const rawDurationSeconds = Number(timeSeconds)
    const rp = Number(runningPercent)

    if (!Number.isFinite(distMeters) || distMeters <= 0) {
      setError('Distance (m) must be greater than zero.')
      return
    }
    const durationSeconds = Math.round(rawDurationSeconds * 100) / 100
    if (!Number.isFinite(durationSeconds)) {
      setError('Time (seconds) must be a valid number.')
      return
    }
    if (durationSeconds <= 0) {
      setError('Duration must be greater than zero.')
      return
    }
    if (!Number.isFinite(rp) || rp < 0 || rp > 100) {
      setError('Running % must be between 0 and 100.')
      return
    }

    setSaving(true)
    setError('')
    const response = await fetch('/api/training-logs', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: editingId,
        distanceKm: distMeters / 1000,
        durationSeconds,
        runningPercent: rp,
        loggedAt: loggedAt || undefined,
        note: note.trim() || undefined,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to update training log.')
      setSaving(false)
      return
    }

    setSaving(false)
    setEditingId(null)
    router.refresh()
  }

  async function deleteRow(id: string) {
    if (
      !window.confirm(
        'Delete this training session? This cannot be undone.',
      )
    ) {
      return
    }
    setDeletingId(id)
    setError('')
    const response = await fetch('/api/training-logs', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to delete training log.')
      setDeletingId(null)
      return
    }
    if (editingId === id) setEditingId(null)
    setDeletingId(null)
    router.refresh()
  }

  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">No sessions yet. Add your first one above.</p>
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[760px] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40">
            <th className="px-3 py-2.5 font-medium text-foreground">Date</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Distance (m)</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Time (s)</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Running %</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Note</th>
            <th className="px-3 py-2.5 font-medium text-foreground">Action</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const dur = Number(row.duration_seconds)
            const isEditing = editingId === row.id
            return (
              <tr key={row.id} className="border-b border-border align-top last:border-b-0">
                <td className="px-3 py-2.5 text-muted-foreground">
                  {isEditing ? (
                    <Input type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} />
                  ) : (
                    new Date(row.logged_at).toLocaleString('en-GB', {
                      weekday: 'short',
                      day: 'numeric',
                      month: 'short',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-foreground">
                  {isEditing ? (
                    <Input type="number" step="1" min="1" value={distanceMeters} onChange={(e) => setDistanceMeters(e.target.value)} />
                  ) : (
                    Math.round(Number(row.distance_km) * 1000)
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-foreground">
                  {isEditing ? (
                    <Input type="number" min="0.01" step="0.01" value={timeSeconds} onChange={(e) => setTimeSeconds(e.target.value)} />
                  ) : (
                    Number(dur).toFixed(2)
                  )}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-foreground">
                  {isEditing ? (
                    <Input type="number" min="0" max="100" step="1" value={runningPercent} onChange={(e) => setRunningPercent(e.target.value)} />
                  ) : (
                    `${Number(row.running_percent)}%`
                  )}
                </td>
                <td className="max-w-[220px] px-3 py-2.5 text-muted-foreground">
                  {isEditing ? (
                    <Input value={note} onChange={(e) => setNote(e.target.value)} />
                  ) : (row.note?.trim() ? row.note : '—')}
                </td>
                <td className="px-3 py-2.5">
                  {isEditing ? (
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm" onClick={() => void saveEdit()} disabled={saving}>
                        {saving ? 'Saving...' : 'Save'}
                      </Button>
                      <Button type="button" size="sm" variant="outline" onClick={cancelEdit} disabled={saving}>
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => beginEdit(row.id)}
                        disabled={deletingId !== null}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="destructive"
                        onClick={() => void deleteRow(row.id)}
                        disabled={deletingId !== null}
                      >
                        {deletingId === row.id ? 'Deleting...' : 'Delete'}
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
      {error && <p className="px-3 py-3 text-xs text-destructive">{error}</p>}
    </div>
  )
}
