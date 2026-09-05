import { describe, expect, it } from 'vitest'

import { validateDailySpendingFormInput } from './daily-spending-schema'

describe('daily-spending schema', () => {
  describe('category mode', () => {
    it('should sum five monthly estimates into the monthly total and keep the chosen divisor', () => {
      expect(
        validateDailySpendingFormInput({
          alimentacaoDigits: '50000',
          comprasDigits: '10000',
          daysPerMonth: 30,
          lazerDigits: '20000',
          mode: 'category',
          saudeDigits: '5000',
          transporteDigits: '15000',
        }),
      ).toEqual({
        ok: true,
        payload: { days_per_month: 30, monthly_amount_cents: 100000 },
      })
    })

    it('should treat an empty estimate as zero', () => {
      expect(
        validateDailySpendingFormInput({
          alimentacaoDigits: '',
          comprasDigits: '',
          daysPerMonth: 30,
          lazerDigits: '',
          mode: 'category',
          saudeDigits: '',
          transporteDigits: '',
        }),
      ).toEqual({
        ok: true,
        payload: { days_per_month: 30, monthly_amount_cents: 0 },
      })
    })

    it('should reject a monthly total that would exceed the safe integer limit', () => {
      const result = validateDailySpendingFormInput({
        alimentacaoDigits: '9007199254740991',
        comprasDigits: '1',
        daysPerMonth: 30,
        lazerDigits: '0',
        mode: 'category',
        saudeDigits: '0',
        transporteDigits: '0',
      })

      expect(result.ok).toBe(false)
      expect(
        (result as Extract<typeof result, { ok: false }>).errors.total,
      ).toBeDefined()
    })

    it('should report every invalid estimate field at once', () => {
      const result = validateDailySpendingFormInput({
        alimentacaoDigits: 'abc',
        comprasDigits: 'xyz',
        daysPerMonth: 30,
        lazerDigits: '0',
        mode: 'category',
        saudeDigits: '0',
        transporteDigits: '0',
      })

      expect(result.ok).toBe(false)
      const errors = (result as Extract<typeof result, { ok: false }>).errors
      expect(errors.alimentacao).toBeDefined()
      expect(errors.compras).toBeDefined()
    })
  })

  describe('direct mode', () => {
    it('should normalize the daily amount into the monthly total that reproduces it exactly', () => {
      expect(
        validateDailySpendingFormInput({
          dailyDigits: '5000',
          daysPerMonth: 30,
          mode: 'direct',
        }),
      ).toEqual({
        ok: true,
        payload: { days_per_month: 30, monthly_amount_cents: 150000 },
      })
    })

    it('should accept an explicit zero daily amount as disabling projection', () => {
      expect(
        validateDailySpendingFormInput({
          dailyDigits: '0',
          daysPerMonth: 31,
          mode: 'direct',
        }),
      ).toEqual({
        ok: true,
        payload: { days_per_month: 31, monthly_amount_cents: 0 },
      })

      expect(
        validateDailySpendingFormInput({
          dailyDigits: '',
          daysPerMonth: 31,
          mode: 'direct',
        }),
      ).toEqual({
        ok: true,
        payload: { days_per_month: 31, monthly_amount_cents: 0 },
      })
    })

    it('should reject a direct value that would overflow the safe integer limit when multiplied by the divisor', () => {
      const result = validateDailySpendingFormInput({
        dailyDigits: '9007199254740991',
        daysPerMonth: 31,
        mode: 'direct',
      })

      expect(result.ok).toBe(false)
      expect(
        (result as Extract<typeof result, { ok: false }>).errors.dailyAmount,
      ).toBeDefined()
    })

    it('should accept the exact safe integer boundary', () => {
      const result = validateDailySpendingFormInput({
        dailyDigits: String(Math.floor(Number.MAX_SAFE_INTEGER / 31)),
        daysPerMonth: 31,
        mode: 'direct',
      })

      expect(result.ok).toBe(true)
    })
  })

  describe('days per month', () => {
    it('should reject a divisor outside 28 through 31', () => {
      const tooLow = validateDailySpendingFormInput({
        dailyDigits: '5000',
        daysPerMonth: 27,
        mode: 'direct',
      })
      expect(tooLow.ok).toBe(false)
      expect(
        (tooLow as Extract<typeof tooLow, { ok: false }>).errors.daysPerMonth,
      ).toBeDefined()

      const tooHigh = validateDailySpendingFormInput({
        dailyDigits: '5000',
        daysPerMonth: 32,
        mode: 'direct',
      })
      expect(tooHigh.ok).toBe(false)
      expect(
        (tooHigh as Extract<typeof tooHigh, { ok: false }>).errors.daysPerMonth,
      ).toBeDefined()
    })

    it('should accept every supported divisor', () => {
      for (const daysPerMonth of [28, 29, 30, 31]) {
        expect(
          validateDailySpendingFormInput({
            dailyDigits: '5000',
            daysPerMonth,
            mode: 'direct',
          }).ok,
        ).toBe(true)
      }
    })
  })
})
