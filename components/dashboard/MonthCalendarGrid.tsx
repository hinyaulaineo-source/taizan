import Link from 'next/link'
import {
  daysInMonthKey,
  firstWeekdayOfMonthKey,
  WEEKDAY_HEADERS,
} from '@/lib/hk-date'

export type MonthGridEvent = {
  id: string
  href: string
  timeLabel: string
  title: string
  tone?: 'booked' | 'available' | 'published' | 'pending' | 'neutral'
}

const TONE_CLASS: Record<NonNullable<MonthGridEvent['tone']>, string> = {
  booked: 'bg-emerald-500/25 text-emerald-200 hover:bg-emerald-500/40',
  available: 'bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40',
  published: 'bg-indigo-500/25 text-indigo-200 hover:bg-indigo-500/40',
  pending: 'bg-amber-500/25 text-amber-100 hover:bg-amber-500/40',
  neutral: 'bg-zinc-500/25 text-zinc-200 hover:bg-zinc-500/40',
}

const MAX_VISIBLE_DESKTOP = 3
const MAX_VISIBLE_MOBILE = 2

export default function MonthCalendarGrid({
  monthKey,
  todayKey,
  eventsByDay,
}: {
  monthKey: string
  todayKey: string
  eventsByDay: Map<number, MonthGridEvent[]>
}) {
  const dayCount = daysInMonthKey(monthKey)
  const startWeekday = firstWeekdayOfMonthKey(monthKey)
  const totalCells = Math.ceil((startWeekday + dayCount) / 7) * 7

  const cells: Array<{ day: number | null; dateKey: string | null }> = []
  for (let i = 0; i < totalCells; i++) {
    const day = i - startWeekday + 1
    if (day < 1 || day > dayCount) {
      cells.push({ day: null, dateKey: null })
    } else {
      cells.push({
        day,
        dateKey: `${monthKey}-${String(day).padStart(2, '0')}`,
      })
    }
  }

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-border bg-card">
      <div className="grid grid-cols-7 border-b border-border bg-muted/30">
        {WEEKDAY_HEADERS.map((label) => (
          <div
            key={label}
            className="border-r border-border px-1 py-2 text-center text-[10px] font-semibold uppercase tracking-wide text-muted-foreground sm:text-xs [&:nth-child(7n)]:border-r-0"
          >
            <span className="sm:hidden">{label.slice(0, 1)}</span>
            <span className="hidden sm:inline">{label}</span>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell, index) => {
          if (cell.day == null || cell.dateKey == null) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[72px] border-b border-r border-border bg-muted/10 sm:min-h-[110px] [&:nth-child(7n)]:border-r-0"
              />
            )
          }

          const events = eventsByDay.get(cell.day) ?? []
          const isToday = cell.dateKey === todayKey
          const overflowDesktop = Math.max(0, events.length - MAX_VISIBLE_DESKTOP)
          const overflowMobile = Math.max(0, events.length - MAX_VISIBLE_MOBILE)

          return (
            <div
              key={cell.dateKey}
              className={`min-h-[72px] border-b border-r border-border p-1 sm:min-h-[110px] sm:p-1.5 [&:nth-child(7n)]:border-r-0 ${
                isToday ? 'bg-indigo-500/5' : ''
              }`}
            >
              <div className="mb-1 flex items-center justify-between gap-1">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold sm:h-7 sm:w-7 sm:text-sm ${
                    isToday
                      ? 'bg-indigo-500 text-white'
                      : 'text-foreground'
                  }`}
                >
                  {cell.day}
                </span>
                {events.length > 0 ? (
                  <span className="hidden text-[10px] text-muted-foreground sm:inline">
                    {events.length}
                  </span>
                ) : null}
              </div>

              <div className="space-y-0.5">
                {events.map((event, eventIndex) => {
                  const tone = event.tone ?? 'available'
                  const hideOnMobile = eventIndex >= MAX_VISIBLE_MOBILE
                  const hideOnDesktop = eventIndex >= MAX_VISIBLE_DESKTOP
                  if (hideOnDesktop) return null

                  return (
                    <Link
                      key={event.id}
                      href={event.href}
                      title={`${event.timeLabel} ${event.title}`}
                      className={`block truncate rounded px-1 py-0.5 text-[10px] font-medium leading-tight transition sm:text-[11px] ${
                        TONE_CLASS[tone]
                      } ${hideOnMobile ? 'hidden sm:block' : ''}`}
                    >
                      <span className="font-semibold">{event.timeLabel}</span>
                      <span className="hidden sm:inline"> {event.title}</span>
                    </Link>
                  )
                })}

                {overflowMobile > 0 ? (
                  <p className="truncate px-1 text-[10px] text-muted-foreground sm:hidden">
                    +{overflowMobile} more
                  </p>
                ) : null}
                {overflowDesktop > 0 ? (
                  <p className="hidden truncate px-1 text-[10px] text-muted-foreground sm:block">
                    +{overflowDesktop} more
                  </p>
                ) : null}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
