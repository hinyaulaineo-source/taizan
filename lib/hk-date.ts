import { QUOTA_TZ } from '@/lib/session-quota'

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function hkDateParts(input: string | number | Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: QUOTA_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(input))
  const year = parts.find((p) => p.type === 'year')?.value ?? '0000'
  const month = parts.find((p) => p.type === 'month')?.value ?? '01'
  const day = parts.find((p) => p.type === 'day')?.value ?? '01'
  return {
    year,
    month,
    day,
    monthKey: `${year}-${month}`,
    dateKey: `${year}-${month}-${day}`,
  }
}

export function formatHkDate(input: string | number | Date): string {
  const { year, month, day } = hkDateParts(input)
  const weekday = WEEKDAYS_SHORT[new Date(Date.UTC(Number(year), Number(month) - 1, Number(day), 12, 0, 0)).getUTCDay()]
  return `${weekday}, ${Number(day)} ${MONTH_SHORT[Number(month) - 1]} ${year}`
}

function hkTimeParts(input: string | number | Date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: QUOTA_TZ,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date(input))
  return {
    hour: parts.find((p) => p.type === 'hour')?.value ?? '00',
    minute: parts.find((p) => p.type === 'minute')?.value ?? '00',
  }
}

export function formatHkTime(input: string | number | Date): string {
  const { hour, minute } = hkTimeParts(input)
  return `${hour}:${minute}`
}

export function formatHkDateTime(input: string | number | Date): string {
  return `${formatHkDate(input)} ${formatHkTime(input)}`
}

export function formatHkDayMonth(input: string | number | Date): string {
  const { year, month, day } = hkDateParts(input)
  return `${Number(day)} ${MONTH_SHORT[Number(month) - 1]}`
}

export function monthLabel(monthKey: string): string {
  const [year, month] = monthKey.split('-').map(Number)
  return `${MONTH_NAMES[month - 1] ?? monthKey} ${year}`
}

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ''
}

/** Parse YYYY-MM; invalid values fall back to the current HK month. */
export function parseMonthKey(input: string | null | undefined, fallback = hkDateParts(new Date()).monthKey): string {
  if (!input || !/^\d{4}-\d{2}$/.test(input)) return fallback
  const month = Number(input.slice(5, 7))
  if (month < 1 || month > 12) return fallback
  return input
}

export function shiftMonthKey(monthKey: string, delta: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  const shifted = new Date(Date.UTC(year, month - 1 + delta, 1))
  return `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, '0')}`
}

/** Inclusive HK-month bounds as ISO timestamps for filtering scheduled_at. */
export function monthRangeIso(monthKey: string): { startIso: string; endIso: string } {
  const [year, month] = monthKey.split('-').map(Number)
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0) - 8 * 60 * 60 * 1000)
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0) - 8 * 60 * 60 * 1000 - 1)
  return { startIso: start.toISOString(), endIso: end.toISOString() }
}

export function daysInMonthKey(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month, 0)).getUTCDate()
}

export function weekdayShortForMonthDay(monthKey: string, day: number): string {
  const [year, month] = monthKey.split('-').map(Number)
  return WEEKDAYS_SHORT[new Date(Date.UTC(year, month - 1, day, 12, 0, 0)).getUTCDay()]
}

/** 0 = Sunday … 6 = Saturday for day 1 of the HK calendar month. */
export function firstWeekdayOfMonthKey(monthKey: string): number {
  const [year, month] = monthKey.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay()
}

export const WEEKDAY_HEADERS = WEEKDAYS_SHORT

/** `YYYY-MM-DDTHH:mm` in Asia/Hong_Kong for datetime inputs. */
export function toHkDateTimeInputValue(input: string | number | Date): string {
  const { year, month, day } = hkDateParts(input)
  const { hour, minute } = hkTimeParts(input)
  return `${year}-${month}-${day}T${hour}:${minute}`
}

/**
 * Parse a datetime-local value as Asia/Hong_Kong (no DST) into UTC ISO.
 * Accepts `YYYY-MM-DDTHH:mm` or `YYYY-MM-DDTHH:mm:ss`.
 */
export function hkDateTimeInputToIso(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/.exec(value.trim())
  if (!match) {
    throw new Error('Invalid date/time')
  }
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const hour = Number(match[4])
  const minute = Number(match[5])
  const second = Number(match[6] ?? '0')
  // Hong Kong is UTC+8 year-round.
  return new Date(Date.UTC(year, month - 1, day, hour - 8, minute, second)).toISOString()
}

/** Keep the original session's HK calendar date; replace its HK clock time. */
export function applyHkTimeToIso(originalIso: string, timeInput: string): string {
  const { year, month, day } = hkDateParts(originalIso)
  const timePart = timeInput.includes('T') ? timeInput.split('T')[1] ?? '00:00' : timeInput
  const [hour = '00', minute = '00'] = timePart.split(':')
  return hkDateTimeInputToIso(`${year}-${month}-${day}T${hour}:${minute}`)
}
