import { describe, expect, it } from 'vitest'

import { validateStartingPositionFormInput } from './starting-position-schema'

describe('starting-position schema', () => {
  it('should produce signed centavos from the same magnitude and direction', () => {
    expect(
      validateStartingPositionFormInput({
        amountDigits: '5000',
        direction: 'available',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: { balance_cents: 5000, effective_on: '2026-08-26' },
    })

    expect(
      validateStartingPositionFormInput({
        amountDigits: '5000',
        direction: 'negative',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: { balance_cents: -5000, effective_on: '2026-08-26' },
    })

    expect(
      validateStartingPositionFormInput({
        amountDigits: '0',
        direction: 'available',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: { balance_cents: 0, effective_on: '2026-08-26' },
    })
  })

  it('should keep zero as zero regardless of direction', () => {
    expect(
      validateStartingPositionFormInput({
        amountDigits: '0',
        direction: 'negative',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: { balance_cents: 0, effective_on: '2026-08-26' },
    })

    expect(
      validateStartingPositionFormInput({
        amountDigits: '',
        direction: 'negative',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: { balance_cents: 0, effective_on: '2026-08-26' },
    })
  })

  it('should validate the maximum safe integer and reject overflow', () => {
    expect(
      validateStartingPositionFormInput({
        amountDigits: '9007199254740991',
        direction: 'available',
        effectiveOn: '2026-08-26',
      }).ok,
    ).toBe(true)

    expect(
      validateStartingPositionFormInput({
        amountDigits: '9007199254740991',
        direction: 'negative',
        effectiveOn: '2026-08-26',
      }),
    ).toEqual({
      ok: true,
      payload: {
        balance_cents: -9007199254740991,
        effective_on: '2026-08-26',
      },
    })

    const overflow = validateStartingPositionFormInput({
      amountDigits: '9007199254740992',
      direction: 'available',
      effectiveOn: '2026-08-26',
    })
    expect(overflow.ok).toBe(false)
    expect(
      (overflow as Extract<typeof overflow, { ok: false }>).errors.amount,
    ).toBeDefined()
  })

  it('should validate exact calendar dates', () => {
    expect(
      validateStartingPositionFormInput({
        amountDigits: '5000',
        direction: 'available',
        effectiveOn: '2028-02-29',
      }).ok,
    ).toBe(true)

    const invalid = validateStartingPositionFormInput({
      amountDigits: '5000',
      direction: 'available',
      effectiveOn: '2026-02-29',
    })
    expect(invalid.ok).toBe(false)
    expect(
      (invalid as Extract<typeof invalid, { ok: false }>).errors.effectiveOn,
    ).toBeDefined()

    const emptyDate = validateStartingPositionFormInput({
      amountDigits: '5000',
      direction: 'available',
      effectiveOn: '',
    })
    expect(emptyDate.ok).toBe(false)
  })

  it('should accept the full PostgreSQL date range', () => {
    expect(
      validateStartingPositionFormInput({
        amountDigits: '100',
        direction: 'available',
        effectiveOn: '0001-01-01',
      }).ok,
    ).toBe(true)

    expect(
      validateStartingPositionFormInput({
        amountDigits: '100',
        direction: 'available',
        effectiveOn: '9999-12-31',
      }).ok,
    ).toBe(true)
  })

  it('should report both field errors when multiple fields are invalid', () => {
    const result = validateStartingPositionFormInput({
      amountDigits: 'abc',
      direction: 'available',
      effectiveOn: 'invalid',
    })
    expect(result.ok).toBe(false)
    const errors = (result as Extract<typeof result, { ok: false }>).errors
    expect(errors.amount).toBeDefined()
    expect(errors.effectiveOn).toBeDefined()
  })
})
