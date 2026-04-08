'use client'

import React, { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Button } from '@/components/ui/button'

const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

function getLocalDateKey(d: Date) {
  // YYYY-MM-DD in local time
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

const CalendarDay: React.FC<{
  day: number | string
  isHeader?: boolean
  isActive?: boolean
  isBooked?: boolean
  onClick?: () => void
}> = ({ day, isHeader, isActive, isBooked, onClick }) => {
  const base = isHeader ? '' : 'rounded-xl'
  const cellBg = isBooked ? 'bg-emerald-500 text-white' : isActive ? 'bg-indigo-500 text-white' : 'text-muted-foreground'

  if (isHeader) {
    return (
      <div className={`col-span-1 row-span-1 flex h-8 w-8 items-center justify-center ${base} ${cellBg}`}>
        <span className={`font-medium text-xs`}>{day}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={`col-span-1 row-span-1 flex h-8 w-8 items-center justify-center ${base} ${cellBg} border border-transparent hover:border-border`}
    >
      <span className="font-black text-sm">{day}</span>
    </button>
  )
}

export type CalendarEvent = {
  dateKey: string // YYYY-MM-DD
  sessionId: string
  title: string
  isBooked?: boolean
  canBook?: boolean
  bookHref?: string
  cancel?: { href: string; body?: any; label?: string }
}

export function Calendar({
  events = [],
  bookingLink = '/dashboard',
  weeklyLink,
  initialMonth = new Date(),
}: {
  events?: CalendarEvent[]
  bookingLink?: string
  weeklyLink?: string
  initialMonth?: Date
}) {
  const router = useRouter()
  const [mounted, setMounted] = useState(false)
  const [visibleMonth, setVisibleMonth] = useState(initialMonth)
  const [selectedDateKey, setSelectedDateKey] = useState(getLocalDateKey(initialMonth))
  const [cancelLoadingSessionId, setCancelLoadingSessionId] = useState<string | null>(null)
  const [cancelError, setCancelError] = useState<string | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const activeEventMap = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>()
    for (const ev of events) {
      const arr = map.get(ev.dateKey) ?? []
      arr.push(ev)
      map.set(ev.dateKey, arr)
    }
    return map
  }, [events])

  const firstDayOfWeek = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 0).getDate()
  const currentMonthLabel = visibleMonth.toLocaleString('default', { month: 'long' })
  const currentYear = visibleMonth.getFullYear()

  const selectedEvents = activeEventMap.get(selectedDateKey) ?? []

  // Avoid server/client locale-timezone mismatch during hydration.
  if (!mounted) {
    return <div className="rounded-[24px] border border-border bg-card p-5 text-sm text-muted-foreground">Loading calendar...</div>
  }

  const renderCalendarDays = () => {
    const days: React.ReactNode[] = [
      ...dayNames.map((day) => <CalendarDay key={`header-${day}`} day={day} isHeader />),
      ...Array(firstDayOfWeek).fill(null).map((_, i) => (
        <div key={`empty-start-${i}`} className="col-span-1 row-span-1 h-8 w-8" />
      )),
      ...Array(daysInMonth)
        .fill(null)
        .map((_, i) => {
          const dayNumber = i + 1
          const date = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth(), dayNumber)
          const key = getLocalDateKey(date)
          const dayEvents = activeEventMap.get(key) ?? []
          const isBooked = dayEvents.some((e) => e.isBooked)
          const isActive = dayEvents.length > 0
          return (
            <CalendarDay
              key={`date-${key}`}
              day={dayNumber}
              isActive={isActive}
              isBooked={isBooked}
              onClick={() => setSelectedDateKey(key)}
            />
          )
        }),
    ]
    return days
  }

  return (
    <div className="rounded-[24px] border border-border bg-card p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg md:text-2xl font-semibold text-foreground">TrackZAN Master Calendar</h2>
          <p className="mt-1 text-xs md:text-sm text-muted-foreground">
            Click a day to see sessions. Colors: indigo = sessions available, green = booked.
          </p>
          <div className="mt-3 flex gap-2">
            <Button asChild className="bg-white text-zinc-800 hover:bg-zinc-200">
              <Link href={bookingLink}>Book Now</Link>
            </Button>
            {weeklyLink ? (
              <Button asChild variant="outline" className="text-foreground">
                <Link href={weeklyLink}>Weekly View</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <div className="rounded-[18px] border border-border p-3">
          <div className="flex items-center gap-2">
            <p className="text-sm text-foreground">
              <span className="font-medium">
                {currentMonthLabel}, {currentYear}
              </span>
            </p>
            <span className="h-1 w-1 rounded-full bg-muted-foreground/70" />
            <p className="text-xs text-muted-foreground">Sessions</p>
          </div>
          <div className="mt-4 grid grid-cols-7 grid-rows-5 gap-2 px-1">
            {renderCalendarDays()}
          </div>
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">Selected: {selectedDateKey}</p>
          <Button variant="ghost" className="text-foreground" onClick={() => setVisibleMonth(new Date())}>
            Today
          </Button>
        </div>

        {selectedEvents.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">No sessions on this day.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {selectedEvents
              .slice()
              .sort((a, b) => Number(!!a.isBooked) - Number(!!b.isBooked))
              .map((ev) => (
                <div key={ev.sessionId} className="flex items-center justify-between gap-4 rounded-xl border border-border bg-background/50 px-3 py-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{ev.title}</p>
                    <p className="text-xs text-muted-foreground">{ev.isBooked ? 'Booked' : 'Available'}</p>
                  </div>
                  {ev.isBooked && ev.cancel ? (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 bg-black text-white hover:bg-zinc-800"
                      disabled={cancelLoadingSessionId === ev.sessionId}
                      onClick={async () => {
                        try {
                          setCancelLoadingSessionId(ev.sessionId)
                          setCancelError(null)
                          await fetch(ev.cancel!.href, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(ev.cancel!.body ?? {}),
                          })
                          setCancelLoadingSessionId(null)
                          router.refresh()
                        } catch (e) {
                          setCancelLoadingSessionId(null)
                          setCancelError('Failed to cancel. Try again.')
                        }
                      }}
                    >
                      {cancelLoadingSessionId === ev.sessionId ? 'Cancelling...' : ev.cancel?.label ?? 'Cancel'}
                    </Button>
                  ) : ev.isBooked ? (
                    <span className="rounded-full border border-emerald-700/60 bg-emerald-950 px-2 py-1 text-xs text-emerald-300">
                      Booked
                    </span>
                  ) : ev.canBook && ev.bookHref ? (
                    <Link
                      href={ev.bookHref}
                      className="rounded-md bg-white px-3 py-1.5 text-xs font-medium text-zinc-800 hover:bg-zinc-200"
                    >
                      Book
                    </Link>
                  ) : (
                    <span className="rounded-full border border-amber-900 bg-amber-950 px-2 py-1 text-xs text-amber-200">
                      Locked
                    </span>
                  )}
                </div>
              ))}
          </div>
        )}

        {cancelError && <p className="mt-3 text-sm text-destructive">{cancelError}</p>}

        <div className="mt-4 flex gap-2">
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() =>
              setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))
            }
          >
            Prev
          </Button>
          <Button
            variant="outline"
            className="border-border text-foreground"
            onClick={() =>
              setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))
            }
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  )
}

