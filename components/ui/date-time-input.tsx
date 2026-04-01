'use client'

import { useMemo, useState } from 'react'
import { CalendarWithTimePickerInline, DatePickerInline } from '@/components/ui/calendar-with-time-picker-inline'
import { Input } from '@/components/ui/input'

type DateTimeInputProps = {
  value: string
  onChange: (next: string) => void
  className?: string
}

type DateInputProps = {
  value: string
  onChange: (next: string) => void
  className?: string
}

function toParts(value: string) {
  if (!value) return { date: '', time: '' }
  const [date, time] = value.split('T')
  return { date: date ?? '', time: (time ?? '').slice(0, 5) }
}

export default function DateTimeInput({ value, onChange, className }: DateTimeInputProps) {
  const [open, setOpen] = useState(false)
  const parts = useMemo(() => toParts(value), [value])
  return (
    <div className={className}>
      <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto] md:items-center">
        <Input
          type="date"
          value={parts.date}
          onChange={(e) => onChange(`${e.target.value}T${parts.time || '00:00'}`)}
          className="border-zinc-700 bg-zinc-950 text-zinc-100"
        />
        <Input
          type="time"
          value={parts.time}
          onChange={(e) => onChange(`${parts.date || new Date().toISOString().slice(0, 10)}T${e.target.value}`)}
          className="border-zinc-700 bg-zinc-950 text-zinc-100"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          {open ? 'Hide picker' : 'Pick'}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <CalendarWithTimePickerInline value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}

export function DateInput({ value, onChange, className }: DateInputProps) {
  const [open, setOpen] = useState(false)
  return (
    <div className={className}>
      <div className="grid gap-2 md:grid-cols-[1fr_auto] md:items-center">
        <Input
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="border-zinc-700 bg-zinc-950 text-zinc-100"
        />
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="h-9 rounded-md border border-zinc-700 px-3 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          {open ? 'Hide picker' : 'Pick'}
        </button>
      </div>
      {open && (
        <div className="mt-3">
          <DatePickerInline value={value} onChange={onChange} />
        </div>
      )}
    </div>
  )
}
