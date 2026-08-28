import { getTransactionMonth } from './transaction-calendar'
import { TRANSACTION_ERROR_COPY } from './transaction-errors'
import { TRANSACTION_KIND_ORDER } from './transaction-kind'
import { parseCentavoDigits } from './transaction-money'
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  type TransactionKind,
} from './transaction-types'

export type TransactionFormInput = {
  amountDigits: string
  date: string
  description: string
  kind: TransactionKind
}

export type TransactionPayload = {
  amount_cents: number
  description: string | null
  kind: TransactionKind
  transaction_date: string
}

export type TransactionFormFieldErrors = Partial<
  Record<'amount' | 'date' | 'description' | 'kind', string>
>

export type TransactionFormValidationResult =
  | { errors: TransactionFormFieldErrors; ok: false }
  | { ok: true; payload: TransactionPayload }

function isValidTransactionDate(date: string) {
  try {
    getTransactionMonth(date)
    return true
  } catch {
    return false
  }
}

export function validateTransactionFormInput(
  input: TransactionFormInput,
): TransactionFormValidationResult {
  const errors: TransactionFormFieldErrors = {}

  if (!TRANSACTION_KIND_ORDER.includes(input.kind)) {
    errors.kind = TRANSACTION_ERROR_COPY.kindRequired
  }

  const amountCents = parseCentavoDigits(input.amountDigits)

  if (amountCents === null || amountCents <= 0) {
    errors.amount = TRANSACTION_ERROR_COPY.amountRequired
  }

  const trimmedDescription = input.description.trim()

  if (trimmedDescription.length > TRANSACTION_DESCRIPTION_MAX_LENGTH) {
    errors.description = TRANSACTION_ERROR_COPY.descriptionTooLong
  }

  if (!isValidTransactionDate(input.date)) {
    errors.date = TRANSACTION_ERROR_COPY.dateOutOfRange
  }

  if (Object.keys(errors).length > 0) {
    return { errors, ok: false }
  }

  return {
    ok: true,
    payload: {
      amount_cents: amountCents as number,
      description: trimmedDescription.length > 0 ? trimmedDescription : null,
      kind: input.kind,
      transaction_date: input.date,
    },
  }
}

// Fixed key order matches the submission snapshot the create form compares
// before minting or reusing an idempotency UUID. See the plan's "RPC
// contract" section for the full rule.
export function serializeTransactionPayload(payload: TransactionPayload) {
  return JSON.stringify({
    kind: payload.kind,
    amount_cents: payload.amount_cents,
    description: payload.description,
    transaction_date: payload.transaction_date,
  })
}
