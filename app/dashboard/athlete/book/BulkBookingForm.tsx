'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Calendar, type CalendarEvent } from '@/components/ui/calendar'
import { Button } from '@/components/ui/button'

type SessionOption = {
  id: string
  title: string
  scheduled_at: string
  location: string | null
  isBooked: boolean
  created_at?: string | null
}

export default function BulkBookingForm({ sessions }: { sessions: SessionOption[] }) {
  const router = useRouter()
  const [selected, setSelected] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const calendarEvents = useMemo<CalendarEvent[]>(() => {
    const dateKeyFromScheduledAt = (scheduledAt: string) => {
      const d = new Date(scheduledAt)
      const yyyy = d.getFullYear()
      const mm = String(d.getMonth() + 1).padStart(2, '0')
      const dd = String(d.getDate()).padStart(2, '0')
      return `${yyyy}-${mm}-${dd}`
    }
    return sessions.map((s) => ({
      dateKey: dateKeyFromScheduledAt(s.scheduled_at),
      sessionId: s.id,
      title: `${s.title}${s.location ? ` · ${s.location}` : ''}`,
      isBooked: s.isBooked,
      canBook: !s.isBooked,
    }))
  }, [sessions])

  const sessionsByCreatedDate = useMemo(() => {
    const groups = new Map<string, SessionOption[]>()
    sessions.forEach((s) => {
      const key = s.created_at ? new Date(s.created_at).toLocaleDateString() : 'Unknown date'
      const arr = groups.get(key) ?? []
      arr.push(s)
      groups.set(key, arr)
    })
    return Array.from(groups.entries())
  }, [sessions])

  function toggle(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  async function handleBulkBook() {
    if (selected.length === 0) return
    setLoading(true)
    setError('')
    const response = await fetch('/api/bookings/bulk', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionIds: selected }),
    })
    if (!response.ok) {
      const data = (await response.json().catch(() => null)) as { error?: string } | null
      setError(data?.error ?? 'Failed to book sessions.')
      setLoading(false)
      return
    }
    router.push('/dashboard/athlete')
    router.refresh()
  }

  return (
    <div className="space-y-6">
      <Calendar events={calendarEvents} bookingLink="/dashboard/athlete/book" initialMonth={new Date()} />

      <section>
        <h2 className="mb-3 text-base font-semibold text-zinc-100">Choose sessions to book</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-zinc-500">No eligible sessions right now.</p>
        ) : (
          <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
            {sessionsByCreatedDate.map(([createdDate, group]) => (
              <div key={createdDate}>
                <p className="mb-2 text-xs uppercase tracking-wide text-zinc-500">
                  Created on {createdDate}
                </p>
                <div className="space-y-2">
                  {group.map((s) => (
                    <label
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-semibold text-zinc-100">{s.title}</p>
                        {(() => {
                          const dt = new Date(s.scheduled_at)
                          const weekday = dt.toLocaleDateString(undefined, { weekday: 'long' })
                          return <p className="text-xs text-zinc-400">{weekday}</p>
                        })()}
                        <p className="text-xs text-zinc-500">
                          {new Date(s.scheduled_at).toLocaleString()}
                          {s.location ? ` · ${s.location}` : ''}
                        </p>
                      </div>
                      {s.isBooked ? (
                        <span className="rounded-full border border-emerald-800 bg-emerald-950 px-2 py-1 text-xs text-emerald-300">
                          Booked
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selected.includes(s.id)}
                          onChange={() => toggle(s.id)}
                          className="h-4 w-4 accent-white"
                        />
                      )}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {error && <p className="text-sm text-red-300">{error}</p>}
      <Button onClick={handleBulkBook} disabled={loading || selected.length === 0}>
        {loading ? 'Booking...' : `Book selected (${selected.length})`}
      </Button>
    </div>
  )
}
