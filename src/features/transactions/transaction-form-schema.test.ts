import { describe, expect, it } from 'vitest'

import {
  serializeTransactionPayload,
  validateTransactionFormInput,
  type TransactionFormInput,
} from './transaction-form-schema'

function input(overrides: Partial<TransactionFormInput> = {}) {
  return {
    amountDigits: '5000',
    date: '2026-08-25',
    description: '',
    kind: 'expense' as const,
    ...overrides,
  }
}

describe('validateTransactionFormInput', () => {
  it('should accept a valid expense with no description', () => {
    const result = validateTransactionFormInput(input())

    expect(result).toEqual({
      ok: true,
      payload: {
        amount_cents: 5000,
        description: null,
        kind: 'expense',
        transaction_date: '2026-08-25',
      },
    })
  })

  it('should accept a valid income with a trimmed description', () => {
    const result = validateTransactionFormInput(
      input({ description: '  Salário  ', kind: 'income' }),
    )

    expect(result).toEqual({
      ok: true,
      payload: {
        amount_cents: 5000,
        description: 'Salário',
        kind: 'income',
        transaction_date: '2026-08-25',
      },
    })
  })

  it('should turn a whitespace-only description into null', () => {
    const result = validateTransactionFormInput(input({ description: '   ' }))

    expect(result.ok).toBe(true)
    expect(result.ok && result.payload.description).toBeNull()
  })

  it('should reject an unsupported kind', () => {
    const result = validateTransactionFormInput(
      // Simulates a caller bypassing the typed form control.
      input({ kind: 'transfer' as never }),
    )

    expect(result).toEqual({
      errors: { kind: expect.any(String) },
      ok: false,
    })
  })

  it.each(['', '0', '00', 'abc', '12.50'])(
    'should reject an invalid amount digit string %s',
    (amountDigits) => {
      const result = validateTransactionFormInput(input({ amountDigits }))

      expect(result.ok).toBe(false)
      expect(!result.ok && result.errors.amount).toEqual(expect.any(String))
    },
  )

  it('should reject an amount above the safe integer limit', () => {
    const result = validateTransactionFormInput(
      input({ amountDigits: '99999999999999999999' }),
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.amount).toEqual(expect.any(String))
  })

  it('should reject a description longer than 120 characters', () => {
    const result = validateTransactionFormInput(
      input({ description: 'a'.repeat(121) }),
    )

    expect(result.ok).toBe(false)
    expect(!result.ok && result.errors.description).toEqual(expect.any(String))
  })

  it('should accept a description at exactly 120 characters', () => {
    const result = validateTransactionFormInput(
      input({ description: 'a'.repeat(120) }),
    )

    expect(result.ok).toBe(true)
  })

  it.each(['2026-13-01', '2026-02-30', '25/08/2026', ''])(
    'should reject an invalid date %s',
    (date) => {
      const result = validateTransactionFormInput(input({ date }))

      expect(result.ok).toBe(false)
      expect(!result.ok && result.errors.date).toEqual(expect.any(String))
    },
  )
})

describe('serializeTransactionPayload', () => {
  const payload = {
    amount_cents: 5000,
    description: 'Mercado',
    kind: 'expense' as const,
    transaction_date: '2026-08-25',
  }

  it('should produce the same string for the same payload', () => {
    expect(serializeTransactionPayload(payload)).toBe(
      serializeTransactionPayload({ ...payload }),
    )
  })

  it('should produce a different string when the kind changes', () => {
    expect(serializeTransactionPayload(payload)).not.toBe(
      serializeTransactionPayload({ ...payload, kind: 'income' }),
    )
  })

  it('should produce a different string when the amount changes', () => {
    expect(serializeTransactionPayload(payload)).not.toBe(
      serializeTransactionPayload({ ...payload, amount_cents: 5001 }),
    )
  })

  it('should produce a different string when the description changes', () => {
    expect(serializeTransactionPayload(payload)).not.toBe(
      serializeTransactionPayload({ ...payload, description: null }),
    )
  })

  it('should produce a different string when the date changes', () => {
    expect(serializeTransactionPayload(payload)).not.toBe(
      serializeTransactionPayload({
        ...payload,
        transaction_date: '2026-08-26',
      }),
    )
  })
})
