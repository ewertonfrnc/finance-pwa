const MAX_SAFE_CENTAVOS = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_SAFE_CENTAVOS = BigInt(Number.MIN_SAFE_INTEGER)

const wholeReaisFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
})

/**
 * Parses a digit-only string as centavos.
 * Returns a safe integer number of centavos or null when the input is not
 * a valid unsigned digit string within the JavaScript safe integer range.
 */
export function parseCentavoDigits(digits: string): number | null {
  if (!/^\d+$/.test(digits)) return null
  const amount = BigInt(digits)
  if (amount > MAX_SAFE_CENTAVOS) return null
  return Number(amount)
}

/**
 * Formats an unsigned centavo amount as BRL without floating point.
 * Expects a non-negative safe integer in centavos.
 */
export function formatUnsignedCents(amountCents: number | bigint): string {
  const amount = BigInt(amountCents)
  if (amount < 0n) throw new Error('Amount cannot be negative.')
  const wholeReais = amount / 100n
  const centavos = amount % 100n
  return `R$ ${wholeReaisFormatter.format(wholeReais)},${String(centavos).padStart(2, '0')}`
}

/**
 * Formats a signed centavo amount as BRL without floating point.
 * Uses the Unicode minus sign (U+2212) for negative values so the glyph
 * matches the monetary font subset and avoids the ASCII hyphen.
 */
export function formatSignedCents(amountCents: number | bigint): string {
  const amount = BigInt(amountCents)
  const isNegative = amount < 0n
  const absolute = isNegative ? -amount : amount
  const wholeReais = absolute / 100n
  const centavos = absolute % 100n
  const formatted = `R$ ${wholeReaisFormatter.format(wholeReais)},${String(centavos).padStart(2, '0')}`
  return isNegative ? `\u2212${formatted}` : formatted
}

/**
 * Formats a digit-driven draft as BRL centavos.
 * An empty string is treated as zero.
 */
export function formatCentavoDigits(digits: string): string {
  return formatUnsignedCents(digits.length > 0 ? BigInt(digits) : 0n)
}

/**
 * Maximum and minimum safe centavo values as BigInt for reuse.
 */
export const BR_MONEY_SAFE_RANGE = {
  max: MAX_SAFE_CENTAVOS,
  min: MIN_SAFE_CENTAVOS,
} as const
