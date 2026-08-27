const maximumSafeCentavos = BigInt(Number.MAX_SAFE_INTEGER)

const wholeReaisFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 0,
  minimumFractionDigits: 0,
  useGrouping: true,
})

export function parseCentavoDigits(digits: string) {
  if (!/^\d+$/.test(digits)) return null

  const amount = BigInt(digits)

  if (amount > maximumSafeCentavos) return null

  return Number(amount)
}

export function formatAmountCents(amountCents: number | bigint) {
  const amount = BigInt(amountCents)

  if (amount < 0n) throw new Error('Transaction amount cannot be negative.')

  const wholeReais = amount / 100n
  const centavos = amount % 100n

  return `R$ ${wholeReaisFormatter.format(wholeReais)},${String(centavos).padStart(2, '0')}`
}

export function formatCentavoDigits(digits: string) {
  return formatAmountCents(digits.length > 0 ? BigInt(digits) : 0n)
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
