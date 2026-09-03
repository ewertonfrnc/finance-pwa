const monthPattern = /^(\d{4})-(\d{2})$/
const datePattern = /^(\d{4})-(\d{2})-(\d{2})$/

function pad(value: number, length = 2): string {
  return String(value).padStart(length, '0')
}

export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)
    return isLeapYear ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

export function parseCalendarMonth(
  value: string,
): { month: number; year: number } | null {
  const match = monthPattern.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  if (year < 1 || year > 9999 || month < 1 || month > 12) return null
  return { month, year }
}

export function parseCalendarDate(
  value: string,
): { day: number; month: number; year: number } | null {
  const match = datePattern.exec(value)
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  ) {
    return null
  }
  return { day, month, year }
}

export function isValidCalendarDate(value: string): boolean {
  return parseCalendarDate(value) !== null
}

/**
 * Creates a Date at local noon for the given calendar parts.
 * Noon avoids DST day-boundary shifts when the Date is only used for
 * presentation via Intl.DateTimeFormat.
 */
export function createCalendarDate(
  year: number,
  month: number,
  day: number,
): Date {
  const date = new Date(0)
  date.setHours(12, 0, 0, 0)
  date.setFullYear(year, month - 1, day)
  return date
}

export function toIsoDate(year: number, month: number, day: number): string {
  return `${pad(year, 4)}-${pad(month)}-${pad(day)}`
}

export function toIsoMonth(year: number, month: number): string {
  return `${pad(year, 4)}-${pad(month)}`
}

/**
 * Returns the device-local current date as YYYY-MM-DD.
 * Uses local getters so the value never shifts through UTC.
 */
export function getLocalTodayIsoDate(today = new Date()): string {
  return toIsoDate(today.getFullYear(), today.getMonth() + 1, today.getDate())
}

/**
 * Returns the device-local current month as YYYY-MM.
 */
export function getLocalCurrentMonthIso(today = new Date()): string {
  return toIsoMonth(today.getFullYear(), today.getMonth() + 1)
}
