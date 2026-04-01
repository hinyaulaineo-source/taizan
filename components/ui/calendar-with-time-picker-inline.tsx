'use client'

import * as React from 'react'

import { CalendarPicker } from '@/components/ui/calendar-picker'
import { Card, CardContent, CardFooter } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

type DateTimeProps = {
  value: string
  onChange: (next: string) => void
  className?: string
}

type DateOnlyProps = {
  value: string
  onChange: (next: string) => void
  className?: string
}

function parseDateTime(value: string): { date: Date | undefined; timeFrom: string; timeTo: string } {
  if (!value) return { date: undefined, timeFrom: '10:30:00', timeTo: '12:30:00' }
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return { date: undefined, timeFrom: '10:30:00', timeTo: '12:30:00' }
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  const ss = String(d.getSeconds()).padStart(2, '0')
  return { date: d, timeFrom: `${hh}:${mm}:${ss}`, timeTo: `${hh}:${mm}:${ss}` }
}

function toLocalDateString(d: Date): string {
  const yyyy = d.getFullYear()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

function combine(date: Date, time: string): string {
  const [h, m, s] = time.split(':').map(Number)
  const dt = new Date(date.getFullYear(), date.getMonth(), date.getDate(), h || 0, m || 0, s || 0)
  const yyyy = dt.getFullYear()
  const mm = String(dt.getMonth() + 1).padStart(2, '0')
  const dd = String(dt.getDate()).padStart(2, '0')
  const hh = String(dt.getHours()).padStart(2, '0')
  const mi = String(dt.getMinutes()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`
}

export function CalendarWithTimePickerInline({ value, onChange, className }: DateTimeProps) {
  const parsed = React.useMemo(() => parseDateTime(value), [value])
  const [date, setDate] = React.useState<Date | undefined>(parsed.date)
  const [timeFrom, setTimeFrom] = React.useState(parsed.timeFrom)

  React.useEffect(() => {
    setDate(parsed.date)
    setTimeFrom(parsed.timeFrom)
  }, [parsed.date?.getTime(), parsed.timeFrom])

  return (
    <Card className={cn('w-fit py-4', className)}>
      <CardContent className="px-4">
        <CalendarPicker
          mode="single"
          selected={date}
          onSelect={(d) => {
            setDate(d)
            if (d) onChange(combine(d, timeFrom))
          }}
          className="bg-transparent p-0 [--cell-size:--spacing(10.5)]"
        />
      </CardContent>
      <CardFooter className="flex gap-2 border-t px-4 !pt-4 *:[div]:w-full">
        <div>
          <Label htmlFor="time-from" className="sr-only">
            Start Time
          </Label>
          <Input
            id="time-from"
            type="time"
            step="1"
            value={timeFrom}
            onChange={(e) => {
              setTimeFrom(e.target.value)
              if (date) onChange(combine(date, e.target.value))
            }}
            className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
        </div>
        <span>-</span>
        <div>
          <Label htmlFor="time-to" className="sr-only">
            End Time
          </Label>
          <Input
            id="time-to"
            type="time"
            step="1"
            value={timeFrom}
            onChange={(e) => {
              setTimeFrom(e.target.value)
              if (date) onChange(combine(date, e.target.value))
            }}
            className="appearance-none [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none"
          />
        </div>
      </CardFooter>
    </Card>
  )
}

export function DatePickerInline({ value, onChange, className }: DateOnlyProps) {
  const selected = value ? new Date(`${value}T00:00:00`) : undefined
  return (
    <Card className={cn('w-fit py-4', className)}>
      <CardContent className="px-4">
        <CalendarPicker
          mode="single"
          selected={selected}
          onSelect={(d) => onChange(d ? toLocalDateString(d) : '')}
          className="bg-transparent p-0 [--cell-size:--spacing(10.5)]"
        />
      </CardContent>
    </Card>
  )
}

export const Component = CalendarWithTimePickerInline
