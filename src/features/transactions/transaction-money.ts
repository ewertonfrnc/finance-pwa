import {
  formatCentavoDigits as formatSharedCentavoDigits,
  formatUnsignedCents,
  parseCentavoDigits as parseSharedCentavoDigits,
} from '../../lib/brl-money'

export function parseCentavoDigits(digits: string) {
  return parseSharedCentavoDigits(digits)
}

export function formatAmountCents(amountCents: number | bigint) {
  const amount = BigInt(amountCents)

  if (amount < 0n) throw new Error('Transaction amount cannot be negative.')

  return formatUnsignedCents(amount)
}

export function formatCentavoDigits(digits: string) {
  return formatSharedCentavoDigits(digits)
}

// Inverse of parseCentavoDigits: turns a persisted amount back into the digit
// string the form edits. A fractional or negative amount would silently
// produce a value the digit input cannot parse, so it fails loudly instead.
export function toCentavoDigits(amountCents: number) {
  if (!Number.isSafeInteger(amountCents) || amountCents < 0) {
    throw new Error('Transaction amount must be a safe positive integer.')
  }

  return amountCents === 0 ? '' : String(amountCents)
}
