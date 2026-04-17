'use client'

import { useMemo, useState } from 'react'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

export type TrainingLogChartPoint = {
  id: string
  loggedAt: string
  distanceMeters: number
  durationSeconds: number
  runningPercent: number
}

type Metric = 'duration' | 'running'

export default function TrainingProgressionChart({ logs }: { logs: TrainingLogChartPoint[] }) {
  const [metric, setMetric] = useState<Metric>('duration')

  const groupedByDistance = useMemo(() => {
    const grouped = new Map<number, Array<{
      id: string
      loggedAt: string
      durationSeconds: number
      runningPercent: number
    }>>()

    for (const row of logs) {
      const distanceMeters = Math.round(row.distanceMeters)
      const current = grouped.get(distanceMeters) ?? []
      current.push({
        id: row.id,
        loggedAt: row.loggedAt,
        durationSeconds: row.durationSeconds,
        runningPercent: row.runningPercent,
      })
      grouped.set(distanceMeters, current)
    }

    return Array.from(grouped.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([distanceMeters, points]) => ({
        distanceMeters,
        points: points.sort(
          (a, b) => new Date(a.loggedAt).getTime() - new Date(b.loggedAt).getTime(),
        ),
      }))
  }, [logs])

  const dataKey = metric === 'duration' ? 'durationSeconds' : 'runningPercent'
  const yLabel = metric === 'duration' ? 'seconds' : '% running'
  const metricLabel = metric === 'duration' ? 'Time (seconds)' : 'Running %'
  const metricUnit = metric === 'duration' ? 's' : '%'
  const [selectedDistance, setSelectedDistance] = useState<number | null>(null)

  if (logs.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-8 text-center text-sm text-muted-foreground">
        No sessions logged yet. Add your first run below to see your progression.
      </p>
    )
  }

  const effectiveDistance =
    selectedDistance ?? groupedByDistance[0]?.distanceMeters ?? null

  const activeGroup =
    effectiveDistance === null
      ? null
      : groupedByDistance.find((g) => g.distanceMeters === effectiveDistance) ?? null

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['duration', 'Time (seconds)'],
            ['running', 'Running %'],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setMetric(key)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              metric === key
                ? 'border-indigo-500 bg-indigo-500/15 text-foreground'
                : 'border-border bg-card text-muted-foreground hover:text-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="max-w-xs">
        <label className="mb-1 block text-xs text-muted-foreground">Distance trend</label>
        <select
          className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground"
          value={effectiveDistance ?? ''}
          onChange={(e) => setSelectedDistance(Number(e.target.value))}
        >
          {groupedByDistance.map((group) => (
            <option key={group.distanceMeters} value={group.distanceMeters}>
              {group.distanceMeters}m
            </option>
          ))}
        </select>
      </div>
      <div className="space-y-4">
        {activeGroup && (
          <div key={activeGroup.distanceMeters} className="rounded-lg border border-border p-3">
            <p className="mb-2 text-xs font-medium text-foreground">
              {activeGroup.distanceMeters}m · {metricLabel} trend
            </p>
            <div className="h-[220px] w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={activeGroup.points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="loggedAt"
                    tickFormatter={(v) =>
                      new Date(v as string).toLocaleDateString('en-GB', {
                        month: 'short',
                        day: 'numeric',
                      })
                    }
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    stroke="var(--border)"
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
                    stroke="var(--border)"
                    width={44}
                    label={{
                      value: yLabel,
                      angle: -90,
                      position: 'insideLeft',
                      style: { fontSize: 10, fill: 'var(--muted-foreground)' },
                    }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'var(--card)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                    labelFormatter={(v) =>
                      new Date(v as string).toLocaleString('en-GB', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    }
                    formatter={(value) => {
                      const n = typeof value === 'number' ? value : Number(value)
                      const display =
                        metric === 'duration' && Number.isFinite(n)
                          ? n.toFixed(2)
                          : value
                      return [display, metricUnit]
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey={dataKey}
                    stroke="var(--chart-1)"
                    strokeWidth={2}
                    dot={{ r: 3, fill: 'var(--chart-1)' }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
