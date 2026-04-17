'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export default function TrainingLogForm() {
  const router = useRouter()
  const [distanceMeters, setDistanceMeters] = useState('')
  const [timeSeconds, setTimeSeconds] = useState('')
  const [runningPercent, setRunningPercent] = useState('')
  const [loggedAt, setLoggedAt] = useState('')
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function submit() {
    const distMeters = Number(distanceMeters)
    const rawDurationSeconds = Number(timeSeconds)
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
    const rp = Number(runningPercent)
    if (!Number.isFinite(rp) || rp < 0 || rp > 100) {
      setError('Running % must be between 0 and 100.')
      return
    }

    setLoading(true)
    setError('')
    const response = await fetch('/api/training-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        distanceKm: distMeters / 1000,
        durationSeconds,
        runningPercent: rp,
        loggedAt: loggedAt || undefined,
        note: note.trim() || undefined,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to save training log.')
      setLoading(false)
      return
    }

    setDistanceMeters('')
    setTimeSeconds('')
    setRunningPercent('')
    setLoggedAt('')
    setNote('')
    setLoading(false)
    router.refresh()
  }

  return (
    <div className="mt-4 space-y-3 border-t border-border pt-4">
      <p className="text-xs font-medium text-foreground">Log a session</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Distance (m)</label>
          <Input
            type="number"
            step="1"
            min="1"
            placeholder="e.g. 120"
            value={distanceMeters}
            onChange={(e) => setDistanceMeters(e.target.value)}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-muted-foreground">Running (% of session)</label>
          <Input
            type="number"
            step="1"
            min="0"
            max="100"
            placeholder="0–100"
            value={runningPercent}
            onChange={(e) => setRunningPercent(e.target.value)}
          />
        </div>
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Time (seconds)</label>
        <Input
          type="number"
          min="0.01"
          step="0.01"
          placeholder="e.g. 12.35"
          value={timeSeconds}
          onChange={(e) => setTimeSeconds(e.target.value)}
          className="sm:max-w-xs"
        />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Session date (optional)</label>
        <Input type="date" value={loggedAt} onChange={(e) => setLoggedAt(e.target.value)} className="sm:max-w-xs" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted-foreground">Note (optional)</label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="Easy long run, track workout…" />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading} className="bg-white text-zinc-800 hover:bg-zinc-200">
          {loading ? 'Saving…' : 'Add session'}
        </Button>
      </div>
    </div>
  )
}
