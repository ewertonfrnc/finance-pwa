import { describe, expect, it } from 'vitest'

import {
  formatCentavoDigits,
  formatSignedCents,
  formatUnsignedCents,
  parseCentavoDigits,
} from './brl-money'

describe('brl-money', () => {
  it('should parse only digits within the safe integer range', () => {
    expect(parseCentavoDigits('5000')).toBe(5000)
    expect(parseCentavoDigits('9007199254740991')).toBe(9007199254740991)
    expect(parseCentavoDigits('9007199254740992')).toBeNull()
    expect(parseCentavoDigits('50.00')).toBeNull()
    expect(parseCentavoDigits('')).toBeNull()
    expect(parseCentavoDigits('-1')).toBeNull()
  })

  it('should format unsigned centavos as BRL without floating point', () => {
    expect(formatUnsignedCents(0)).toBe('R$ 0,00')
    expect(formatUnsignedCents(5000)).toBe('R$ 50,00')
    expect(formatUnsignedCents(9007199254740991)).toBe(
      'R$ 90.071.992.547.409,91',
    )
  })

  it('should format signed centavos with Unicode minus', () => {
    expect(formatSignedCents(0)).toBe('R$ 0,00')
    expect(formatSignedCents(5000)).toBe('R$ 50,00')
    expect(formatSignedCents(-5000)).toBe('\u2212R$ 50,00')
    expect(formatSignedCents(9007199254740991)).toBe('R$ 90.071.992.547.409,91')
    expect(formatSignedCents(-9007199254740991)).toBe(
      '\u2212R$ 90.071.992.547.409,91',
    )
  })

  it('should format a digit-driven draft as centavos', () => {
    expect(formatCentavoDigits('')).toBe('R$ 0,00')
    expect(formatCentavoDigits('5')).toBe('R$ 0,05')
    expect(formatCentavoDigits('5000')).toBe('R$ 50,00')
  })

  it('should reject negative values in the unsigned formatter', () => {
    expect(() => formatUnsignedCents(-1)).toThrow('Amount cannot be negative.')
  })
})
