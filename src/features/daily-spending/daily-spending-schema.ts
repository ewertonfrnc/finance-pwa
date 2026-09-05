import { parseCentavoDigits } from '../../lib/brl-money'

const MAX_SAFE_CENTAVOS = BigInt(Number.MAX_SAFE_INTEGER)
const MIN_DAYS_PER_MONTH = 28
const MAX_DAYS_PER_MONTH = 31

export type DailySpendingCategoryFormInput = {
  alimentacaoDigits: string
  comprasDigits: string
  daysPerMonth: number
  lazerDigits: string
  mode: 'category'
  saudeDigits: string
  transporteDigits: string
}

export type DailySpendingDirectFormInput = {
  dailyDigits: string
  daysPerMonth: number
  mode: 'direct'
}

export type DailySpendingFormInput =
  DailySpendingCategoryFormInput | DailySpendingDirectFormInput

export type DailySpendingPayload = {
  days_per_month: number
  monthly_amount_cents: number
}

export type DailySpendingFieldErrors = Partial<
  Record<
    | 'alimentacao'
    | 'compras'
    | 'dailyAmount'
    | 'daysPerMonth'
    | 'lazer'
    | 'saude'
    | 'total'
    | 'transporte',
    string
  >
>

export type DailySpendingValidationResult =
  | { errors: DailySpendingFieldErrors; ok: false }
  | { ok: true; payload: DailySpendingPayload }

const AMOUNT_ERROR = 'Informe um valor válido.'
const DAYS_ERROR = 'Escolha um divisor entre 28 e 31 dias.'
const TOTAL_OVERFLOW_ERROR = 'Informe um valor suportado.'

function parseMagnitude(digits: string): number | null {
  if (digits === '') return 0
  return parseCentavoDigits(digits)
}

function isValidDaysPerMonth(value: number): boolean {
  return (
    Number.isInteger(value) &&
    value >= MIN_DAYS_PER_MONTH &&
    value <= MAX_DAYS_PER_MONTH
  )
}

function validateCategoryInput(
  input: DailySpendingCategoryFormInput,
  errors: DailySpendingFieldErrors,
): DailySpendingValidationResult {
  const alimentacao = parseMagnitude(input.alimentacaoDigits)
  const transporte = parseMagnitude(input.transporteDigits)
  const lazer = parseMagnitude(input.lazerDigits)
  const compras = parseMagnitude(input.comprasDigits)
  const saude = parseMagnitude(input.saudeDigits)

  if (alimentacao === null) errors.alimentacao = AMOUNT_ERROR
  if (transporte === null) errors.transporte = AMOUNT_ERROR
  if (lazer === null) errors.lazer = AMOUNT_ERROR
  if (compras === null) errors.compras = AMOUNT_ERROR
  if (saude === null) errors.saude = AMOUNT_ERROR

  if (Object.keys(errors).length > 0) return { errors, ok: false }

  // Sum with BigInt: each estimate is individually safe, but their sum can
  // still cross the JavaScript-safe integer limit, and floating-point
  // addition near that limit loses precision before the comparison runs.
  const total =
    BigInt(alimentacao as number) +
    BigInt(transporte as number) +
    BigInt(lazer as number) +
    BigInt(compras as number) +
    BigInt(saude as number)

  if (total > MAX_SAFE_CENTAVOS) {
    return { errors: { total: TOTAL_OVERFLOW_ERROR }, ok: false }
  }

  return {
    ok: true,
    payload: {
      days_per_month: input.daysPerMonth,
      monthly_amount_cents: Number(total),
    },
  }
}

function validateDirectInput(
  input: DailySpendingDirectFormInput,
  errors: DailySpendingFieldErrors,
): DailySpendingValidationResult {
  const daily = parseMagnitude(input.dailyDigits)

  if (daily === null) errors.dailyAmount = AMOUNT_ERROR

  if (Object.keys(errors).length > 0) return { errors, ok: false }

  // The multiplication, not the parsed daily value alone, is where a large
  // but individually safe daily amount can overflow once multiplied by the
  // divisor. BigInt keeps the comparison exact.
  const monthlyTotal = BigInt(daily as number) * BigInt(input.daysPerMonth)

  if (monthlyTotal > MAX_SAFE_CENTAVOS) {
    return { errors: { dailyAmount: TOTAL_OVERFLOW_ERROR }, ok: false }
  }

  return {
    ok: true,
    payload: {
      days_per_month: input.daysPerMonth,
      monthly_amount_cents: Number(monthlyTotal),
    },
  }
}

export function validateDailySpendingFormInput(
  input: DailySpendingFormInput,
): DailySpendingValidationResult {
  const errors: DailySpendingFieldErrors = {}

  if (!isValidDaysPerMonth(input.daysPerMonth)) {
    errors.daysPerMonth = DAYS_ERROR
  }

  return input.mode === 'category'
    ? validateCategoryInput(input, errors)
    : validateDirectInput(input, errors)
}

export const DAILY_SPENDING_ERROR_COPY = {
  amountInvalid: AMOUNT_ERROR,
  daysPerMonthInvalid: DAYS_ERROR,
  totalOverflow: TOTAL_OVERFLOW_ERROR,
} as const
