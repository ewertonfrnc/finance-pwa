import { describe, expect, it } from 'vitest'

import {
  formatAmountCents,
  formatCentavoDigits,
  parseCentavoDigits,
} from './transaction-money'

describe('transaction money', () => {
  it('should format integer centavos as BRL without floating point', () => {
    expect(formatAmountCents(0)).toBe('R$ 0,00')
    expect(formatAmountCents(5000)).toBe('R$ 50,00')
    expect(formatAmountCents(9007199254740991)).toBe('R$ 90.071.992.547.409,91')
  })

  it('should format a digit-driven draft as centavos', () => {
    expect(formatCentavoDigits('')).toBe('R$ 0,00')
    expect(formatCentavoDigits('5')).toBe('R$ 0,05')
    expect(formatCentavoDigits('5000')).toBe('R$ 50,00')
  })

  it('should parse only digits within the safe integer range', () => {
    expect(parseCentavoDigits('5000')).toBe(5000)
    expect(parseCentavoDigits('9007199254740991')).toBe(9007199254740991)
    expect(parseCentavoDigits('9007199254740992')).toBeNull()
    expect(parseCentavoDigits('50.00')).toBeNull()
    expect(parseCentavoDigits('')).toBeNull()
  })
})
