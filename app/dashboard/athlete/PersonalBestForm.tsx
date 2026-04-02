'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

const TRACK_EVENTS = [
  '100m',
  '200m',
  '400m',
  '800m',
  '1500m',
  '3000m',
  '5000m',
  '100mh',
  '110mh',
  '400mh',
] as const

const FIELD_EVENTS = [
  'Long jump',
  'Triple jump',
  'High jump',
  'Pole vault',
  'Shot put',
  'Discus throw',
  'Javelin throw',
  'Hammer throw',
] as const

export default function PersonalBestForm() {
  const router = useRouter()
  const [eventName, setEventName] = useState<string>(TRACK_EVENTS[0])
  const [eventType, setEventType] = useState<'track' | 'field'>('track')
  const [value, setValue] = useState('')
  const [recordedAt, setRecordedAt] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const unit = eventType === 'track' ? 's' : 'm'

  async function submit() {
    if (!eventName.trim() || !value.trim()) {
      setError('Event and value are required.')
      return
    }
    setLoading(true)
    setError('')
    const response = await fetch('/api/personal-bests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        metric: eventName.trim(),
        value: Number(value),
        unit,
        recordedAt: recordedAt || undefined,
      }),
    })

    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to save personal best.')
      setLoading(false)
      return
    }

    setEventName(TRACK_EVENTS[0])
    setEventType('track')
    setValue('')
    setRecordedAt('')
    setLoading(false)
    router.refresh()
  }

  const eventOptions = eventType === 'track' ? TRACK_EVENTS : FIELD_EVENTS

  return (
    <div className="mt-3 space-y-3">
      <div className="grid gap-2 md:grid-cols-2">
        <select
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={eventType}
          onChange={(e) => {
            const nextType = e.target.value as 'track' | 'field'
            setEventType(nextType)
            setEventName(nextType === 'track' ? TRACK_EVENTS[0] : FIELD_EVENTS[0])
          }}
        >
          <option value="track">Track events (PB in time)</option>
          <option value="field">Field events (PB in mark)</option>
        </select>

        <select
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={eventName}
          onChange={(e) => setEventName(e.target.value)}
        >
          {eventOptions.map((event) => (
            <option key={event} value={event}>
              {event}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-2 md:grid-cols-[1fr_100px_170px]">
        <Input
          type="number"
          step="0.01"
          min="0"
          placeholder={eventType === 'track' ? 'Time (seconds)' : 'Mark (metres)'}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Input value={unit} disabled />
        <Input type="date" value={recordedAt} onChange={(e) => setRecordedAt(e.target.value)} />
      </div>

      {error && <p className="text-xs text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading} className="bg-white text-black hover:bg-zinc-200">
          {loading ? 'Saving...' : 'Add PB'}
        </Button>
      </div>
    </div>
  )
}
