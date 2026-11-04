'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { monthLabel } from '@/lib/hk-date'

export type CoachSessionListItem = {
  id: string
  title: string | null
  session_type: string | null
  status: string
  created_at: string | null
  monthKey: string
  dateLabel: string
  createdLabel: string
}

const ALL_MONTHS = 'all'

function groupByBatch(sessions: CoachSessionListItem[]) {
  const groups = new Map<string, CoachSessionListItem[]>()
  for (const session of sessions) {
    const key = session.created_at ?? 'unknown'
    const group = groups.get(key) ?? []
    group.push(session)
    groups.set(key, group)
  }

  return Array.from(groups.entries()).map(([key, group]) => {
    const first = group[0]
    const title = first.title ?? 'Untitled'
    const date = first.createdLabel
    const label =
      group.length > 1 ? `${title} — ${group.length} sessions (${date})` : `${title} (${date})`
    return { key, label, group }
  })
}

export default function CoachSessionList({
  sessions,
  currentMonth,
}: {
  sessions: CoachSessionListItem[]
  currentMonth: string
}) {
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)

  const countsByMonth = useMemo(() => {
    const counts = new Map<string, number>()
    for (const session of sessions) {
      counts.set(session.monthKey, (counts.get(session.monthKey) ?? 0) + 1)
    }
    return counts
  }, [sessions])

  const monthOptions = useMemo(() => {
    const keys = new Set(countsByMonth.keys())
    keys.add(currentMonth)
    return Array.from(keys).sort((a, b) => b.localeCompare(a))
  }, [countsByMonth, currentMonth])

  const monthIndex = selectedMonth === ALL_MONTHS ? -1 : monthOptions.indexOf(selectedMonth)
  const olderMonth = monthIndex >= 0 ? monthOptions[monthIndex + 1] : undefined
  const newerMonth = monthIndex > 0 ? monthOptions[monthIndex - 1] : undefined

  const visibleSessions = useMemo(() => {
    if (selectedMonth === ALL_MONTHS) return sessions
    return sessions.filter((session) => session.monthKey === selectedMonth)
  }, [selectedMonth, sessions])

  const sessionsByBatch = useMemo(() => groupByBatch(visibleSessions), [visibleSessions])
  const showingAll = selectedMonth === ALL_MONTHS

  return (
    <section className="mt-8">
      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-base font-semibold text-foreground">My sessions</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {showingAll
              ? `${sessions.length} session${sessions.length === 1 ? '' : 's'} in total`
              : `${visibleSessions.length} session${visibleSessions.length === 1 ? '' : 's'} in ${monthLabel(selectedMonth)}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/coach/feedback"
            className="rounded-md border border-border px-3 py-2 text-sm text-foreground hover:bg-accent"
          >
            + Add feedback
          </Link>
          <Link
            href="/dashboard/coach/new-session"
            className="rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            + New session
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border text-foreground"
          disabled={showingAll || !olderMonth}
          onClick={() => olderMonth && setSelectedMonth(olderMonth)}
          aria-label="Previous month"
        >
          ‹
        </Button>
        <select
          aria-label="Show sessions by month"
          value={selectedMonth}
          onChange={(event) => setSelectedMonth(event.target.value)}
          suppressHydrationWarning
          className="h-9 min-w-[12rem] rounded-md border border-border bg-background px-3 text-sm text-foreground"
        >
          <option value={ALL_MONTHS}>All sessions ({sessions.length})</option>
          {monthOptions.map((key) => (
            <option key={key} value={key}>
              {monthLabel(key)} ({countsByMonth.get(key) ?? 0})
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-border text-foreground"
          disabled={showingAll || !newerMonth}
          onClick={() => newerMonth && setSelectedMonth(newerMonth)}
          aria-label="Next month"
        >
          ›
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedMonth(currentMonth)}
        >
          This month
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-xs text-muted-foreground hover:text-foreground"
          onClick={() => setSelectedMonth(ALL_MONTHS)}
        >
          All sessions
        </Button>
      </div>

      {sessions.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">No sessions yet. Create your first one.</p>
          </CardContent>
        </Card>
      ) : visibleSessions.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              No sessions in {monthLabel(selectedMonth)}. Choose another month or show all sessions.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="max-h-[520px] space-y-4 overflow-y-auto pr-1">
          {sessionsByBatch.map(({ key, label, group }) => (
            <div key={key}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                {group.length > 1 ? (
                  <Link
                    href={`/dashboard/coach/edit-session/${group[0].id}?batch=1`}
                    className="rounded-md border border-border px-2.5 py-1 text-[11px] text-foreground hover:bg-accent"
                  >
                    Edit batch
                  </Link>
                ) : null}
              </div>
              {group.map((session) => (
                <Card key={session.id} className="mb-2">
                  <CardContent className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-foreground">{session.title}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {session.session_type} · {session.dateLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        tone={
                          session.status === 'published'
                            ? 'success'
                            : session.status === 'pending'
                              ? 'warning'
                              : 'neutral'
                        }
                      >
                        {session.status}
                      </Badge>
                      <Link
                        href={`/dashboard/coach/check-in/${session.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                      >
                        Check-in
                      </Link>
                      <Link
                        href={`/dashboard/coach/edit-session/${session.id}`}
                        className="rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-accent"
                      >
                        Edit
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
