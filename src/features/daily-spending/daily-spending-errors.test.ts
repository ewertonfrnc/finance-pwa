import { describe, expect, it } from 'vitest'

import {
  DAILY_SPENDING_ERROR_COPY,
  getDailySpendingErrorCopy,
  isDailySpendingConflict,
} from './daily-spending-errors'

describe('getDailySpendingErrorCopy', () => {
  it.each([
    [
      '22023',
      'monthly_amount_cents_out_of_range',
      DAILY_SPENDING_ERROR_COPY.monthlyAmountOutOfRange,
    ],
    [
      '22023',
      'days_per_month_out_of_range',
      DAILY_SPENDING_ERROR_COPY.daysPerMonthOutOfRange,
    ],
    ['PT409', 'daily_spending_conflict', DAILY_SPENDING_ERROR_COPY.conflict],
    [
      '42501',
      'authentication_required',
      DAILY_SPENDING_ERROR_COPY.authenticationRequired,
    ],
  ] satisfies [string, string, string][])(
    'should translate %s %s into distinct Portuguese copy',
    (code, message, expected) => {
      expect(getDailySpendingErrorCopy({ code, message })).toBe(expected)
    },
  )

  it('should map every documented code to a distinct copy value', () => {
    const copies = new Set([
      getDailySpendingErrorCopy({
        code: '22023',
        message: 'monthly_amount_cents_out_of_range',
      }),
      getDailySpendingErrorCopy({
        code: '22023',
        message: 'days_per_month_out_of_range',
      }),
      getDailySpendingErrorCopy({
        code: 'PT409',
        message: 'daily_spending_conflict',
      }),
      getDailySpendingErrorCopy({
        code: '42501',
        message: 'authentication_required',
      }),
    ])

    expect(copies.size).toBe(4)
  })

  it('should hide an unrelated privilege denial behind generic permission copy', () => {
    expect(
      getDailySpendingErrorCopy({
        code: '42501',
        message: 'permission denied for table daily_spending_settings',
      }),
    ).toBe(DAILY_SPENDING_ERROR_COPY.permissionDenied)
  })

  it('should not recognize 40001 as the canonical conflict code', () => {
    // daily_spending_settings shipped with PT409 from its first migration
    // and never emitted 40001, unlike the transaction mutation RPCs.
    expect(
      getDailySpendingErrorCopy({
        code: '40001',
        message: 'daily_spending_conflict',
      }),
    ).toBe(DAILY_SPENDING_ERROR_COPY.generic)
    expect(
      isDailySpendingConflict({
        code: '40001',
        message: 'daily_spending_conflict',
      }),
    ).toBe(false)
  })

  it('should hide an unknown error behind generic retry copy without leaking its message', () => {
    expect(
      getDailySpendingErrorCopy({
        code: 'unexpected_provider_failure',
        message:
          'insert into public.daily_spending_settings ... policy violated',
      }),
    ).toBe(DAILY_SPENDING_ERROR_COPY.generic)
  })

  it('should not throw for an error without a code', () => {
    expect(getDailySpendingErrorCopy(new Error('Failed to fetch'))).toBe(
      DAILY_SPENDING_ERROR_COPY.generic,
    )
    expect(getDailySpendingErrorCopy(null)).toBe(
      DAILY_SPENDING_ERROR_COPY.generic,
    )
    expect(getDailySpendingErrorCopy(undefined)).toBe(
      DAILY_SPENDING_ERROR_COPY.generic,
    )
  })
})

describe('isDailySpendingConflict', () => {
  it('should recognize the canonical PT409 conflict', () => {
    expect(
      isDailySpendingConflict({
        code: 'PT409',
        message: 'daily_spending_conflict',
      }),
    ).toBe(true)
  })

  it('should not treat a matching code with a different message as a conflict', () => {
    expect(
      isDailySpendingConflict({ code: 'PT409', message: 'unexpected' }),
    ).toBe(false)
  })

  it('should not recognize an unrelated error as a conflict', () => {
    expect(
      isDailySpendingConflict({
        code: '22023',
        message: 'monthly_amount_cents_out_of_range',
      }),
    ).toBe(false)
    expect(isDailySpendingConflict(new Error('Failed to fetch'))).toBe(false)
    expect(isDailySpendingConflict(null)).toBe(false)
  })
})
