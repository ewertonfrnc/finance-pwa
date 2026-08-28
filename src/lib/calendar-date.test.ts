import { describe, expect, it } from 'vitest'

import {
  createCalendarDate,
  daysInMonth,
  getLocalCurrentMonthIso,
  getLocalTodayIsoDate,
  parseCalendarDate,
  parseCalendarMonth,
  toIsoDate,
} from './calendar-date'

describe('calendar-date', () => {
  it('should parse exact calendar dates and reject invalid values', () => {
    expect(parseCalendarDate('2026-08-25')).toEqual({
      day: 25,
      month: 8,
      year: 2026,
    })
    expect(parseCalendarDate('2028-02-29')).toEqual({
      day: 29,
      month: 2,
      year: 2028,
    })
    expect(parseCalendarDate('2026-02-29')).toBeNull()
    expect(parseCalendarDate('2026-13-01')).toBeNull()
    expect(parseCalendarDate('2026-00-10')).toBeNull()
    expect(parseCalendarDate('2026-02-30')).toBeNull()
    expect(parseCalendarDate('0001-01-01')).toEqual({
      day: 1,
      month: 1,
      year: 1,
    })
    expect(parseCalendarDate('9999-12-31')).toEqual({
      day: 31,
      month: 12,
      year: 9999,
    })
    expect(parseCalendarDate('26-08-25')).toBeNull()
    expect(parseCalendarDate('')).toBeNull()
  })

  it('should handle leap years correctly', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2028, 2)).toBe(29)
    expect(daysInMonth(2000, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 8)).toBe(31)
  })

  it('should parse calendar months', () => {
    expect(parseCalendarMonth('2026-08')).toEqual({ month: 8, year: 2026 })
    expect(parseCalendarMonth('9999-12')).toEqual({ month: 12, year: 9999 })
    expect(parseCalendarMonth('2026-13')).toBeNull()
    expect(parseCalendarMonth('2026-00')).toBeNull()
    expect(parseCalendarMonth('2026-8')).toBeNull()
  })

  it('should derive device-local today without UTC conversion', () => {
    const localDate = new Date(2026, 7, 25, 23, 45)
    expect(getLocalTodayIsoDate(localDate)).toBe('2026-08-25')
    expect(getLocalCurrentMonthIso(localDate)).toBe('2026-08')

    // Same instant would be next day in UTC; local must stay 25th.
    const lateLocal = new Date(2026, 0, 1, 23, 0)
    expect(getLocalTodayIsoDate(lateLocal)).toBe('2026-01-01')
    expect(toIsoDate(2026, 1, 1)).toBe('2026-01-01')
  })

  it('should create a local noon Date for presentation', () => {
    const date = createCalendarDate(2026, 8, 25)
    expect(date.getHours()).toBe(12)
    expect(date.getMinutes()).toBe(0)
    expect(date.getFullYear()).toBe(2026)
    expect(date.getMonth()).toBe(7)
    expect(date.getDate()).toBe(25)
  })
})
