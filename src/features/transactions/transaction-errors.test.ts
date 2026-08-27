import { describe, expect, it } from 'vitest'

import {
  TRANSACTION_ERROR_COPY,
  getTransactionErrorCopy,
  isTransactionConflict,
} from './transaction-errors'

describe('getTransactionErrorCopy', () => {
  it.each([
    ['22023', 'transaction_id_required', TRANSACTION_ERROR_COPY.idRequired],
    ['22023', 'transaction_kind_required', TRANSACTION_ERROR_COPY.kindRequired],
    [
      '22023',
      'transaction_version_required',
      TRANSACTION_ERROR_COPY.versionRequired,
    ],
    [
      '22023',
      'amount_cents_out_of_range',
      TRANSACTION_ERROR_COPY.amountOutOfRange,
    ],
    [
      '22023',
      'transaction_date_out_of_range',
      TRANSACTION_ERROR_COPY.dateOutOfRange,
    ],
    [
      '22023',
      'description_too_long',
      TRANSACTION_ERROR_COPY.descriptionTooLong,
    ],
    ['23505', 'transaction_id_conflict', TRANSACTION_ERROR_COPY.idConflict],
    ['P0002', 'transaction_not_found', TRANSACTION_ERROR_COPY.notFound],
    ['40001', 'transaction_conflict', TRANSACTION_ERROR_COPY.staleVersion],
    [
      '42501',
      'authentication_required',
      TRANSACTION_ERROR_COPY.authenticationRequired,
    ],
  ])('should translate %s %s into safe copy', (code, message, expected) => {
    expect(getTransactionErrorCopy({ code, message })).toBe(expected)
  })

  it('should hide an unrelated privilege denial behind generic permission copy', () => {
    expect(
      getTransactionErrorCopy({
        code: '42501',
        message: 'permission denied for table transactions',
      }),
    ).toBe(TRANSACTION_ERROR_COPY.permissionDenied)
  })

  it('should hide an unknown error behind generic retry copy without leaking its message', () => {
    expect(
      getTransactionErrorCopy({
        code: 'unexpected_provider_failure',
        message: 'insert into public.transactions ... policy violated',
      }),
    ).toBe(TRANSACTION_ERROR_COPY.generic)
  })

  it('should not throw for an error without a code', () => {
    expect(getTransactionErrorCopy(new Error('Failed to fetch'))).toBe(
      TRANSACTION_ERROR_COPY.generic,
    )
    expect(getTransactionErrorCopy(null)).toBe(TRANSACTION_ERROR_COPY.generic)
    expect(getTransactionErrorCopy(undefined)).toBe(
      TRANSACTION_ERROR_COPY.generic,
    )
  })

  it('should recognize only the stale version failure as recoverable by reloading', () => {
    expect(
      isTransactionConflict({ code: '40001', message: 'transaction_conflict' }),
    ).toBe(true)
    expect(
      isTransactionConflict({
        code: 'P0002',
        message: 'transaction_not_found',
      }),
    ).toBe(false)
    expect(isTransactionConflict(new Error('Failed to fetch'))).toBe(false)
    expect(isTransactionConflict(null)).toBe(false)
  })
})
