import { describe, expect, it } from 'vitest'

import type { Transaction } from './transaction-types'
import {
  formatTransactionDate,
  formatTransactionDateFootnote,
  formatTransactionMonth,
  getDefaultTransactionDate,
  getLocalCurrentMonth,
  getMonthBounds,
  getTransactionMonth,
  groupTransactionsByDate,
  isTransactionMonth,
  shiftTransactionMonth,
} from './transaction-calendar'

function transaction(id: string, transactionDate: string): Transaction {
  return {
    amount_cents: 5000,
    created_at: '2026-08-25T12:00:00Z',
    description: id,
    id,
    kind: 'expense',
    transaction_date: transactionDate,
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
  }
}

describe('transaction calendar', () => {
  it('should derive the current month from the device-local calendar', () => {
    const localDate = new Date(2026, 7, 25, 23, 45)

    expect(getLocalCurrentMonth(localDate)).toBe('2026-08')
  })

  it('should accept only supported calendar months', () => {
    expect(isTransactionMonth('0001-01')).toBe(true)
    expect(isTransactionMonth('9999-12')).toBe(true)
    expect(isTransactionMonth('2026-00')).toBe(false)
    expect(isTransactionMonth('2026-13')).toBe(false)
    expect(isTransactionMonth('26-08')).toBe(false)
    expect(isTransactionMonth(null)).toBe(false)
  })

  it('should derive exact month bounds without timezone conversion', () => {
    expect(getMonthBounds('2026-12')).toEqual({
      monthEnd: null,
      monthStart: '2026-12-01',
      nextMonthStart: '2027-01-01',
    })
    expect(getMonthBounds('9999-12')).toEqual({
      monthEnd: '9999-12-31',
      monthStart: '9999-12-01',
      nextMonthStart: null,
    })
  })

  it('should navigate across years and stop at the supported range', () => {
    expect(shiftTransactionMonth('2026-01', -1)).toBe('2025-12')
    expect(shiftTransactionMonth('2026-12', 1)).toBe('2027-01')
    expect(shiftTransactionMonth('0001-01', -1)).toBeNull()
    expect(shiftTransactionMonth('9999-12', 1)).toBeNull()
  })

  it('should clamp a default date to the selected month', () => {
    const today = new Date(2026, 0, 31, 10)

    expect(getDefaultTransactionDate('2026-01', today)).toBe('2026-01-31')
    expect(getDefaultTransactionDate('2026-02', today)).toBe('2026-02-28')
    expect(getDefaultTransactionDate('2028-02', today)).toBe('2028-02-29')
  })

  it('should group ordered transactions by their calendar date', () => {
    const first = transaction('first', '2026-08-25')
    const second = transaction('second', '2026-08-25')
    const third = transaction('third', '2026-08-24')

    expect(groupTransactionsByDate([first, second, third])).toEqual([
      { date: '2026-08-25', transactions: [first, second] },
      { date: '2026-08-24', transactions: [third] },
    ])
  })

  it('should format month and date labels from local calendar parts', () => {
    expect(formatTransactionMonth('2026-08')).toBe('Agosto de 2026')
    expect(formatTransactionDate('2026-08-25')).toBe(
      'Terça-feira, 25 de agosto',
    )
  })

  it('should derive the calendar month of a date-only value', () => {
    expect(getTransactionMonth('2026-08-25')).toBe('2026-08')
    expect(() => getTransactionMonth('2026-13-01')).toThrow(
      'Invalid transaction date: 2026-13-01',
    )
  })

  describe('formatTransactionDateFootnote', () => {
    const today = new Date(2026, 7, 26, 10)

    it('should echo today with its weekday', () => {
      expect(formatTransactionDateFootnote('2026-08-26', today)).toBe(
        'Hoje · quarta-feira',
      )
    })

    it('should read yesterday as a relative day', () => {
      expect(formatTransactionDateFootnote('2026-08-25', today)).toBe(
        'Terça-feira, 25 de agosto · ontem',
      )
    })

    it('should read tomorrow as a relative day', () => {
      expect(formatTransactionDateFootnote('2026-08-27', today)).toBe(
        'Quinta-feira, 27 de agosto · amanhã',
      )
    })

    it('should read a few days ahead in days', () => {
      expect(formatTransactionDateFootnote('2026-08-31', today)).toBe(
        'Segunda-feira, 31 de agosto · em 5 dias',
      )
    })

    it('should read a past month in calendar months', () => {
      expect(formatTransactionDateFootnote('2026-03-26', today)).toBe(
        'Quinta-feira, 26 de março · há 5 meses',
      )
    })

    it('should read a future month in calendar months', () => {
      expect(formatTransactionDateFootnote('2027-01-26', today)).toBe(
        'Terça-feira, 26 de janeiro · em 5 meses',
      )
    })
  })
})
