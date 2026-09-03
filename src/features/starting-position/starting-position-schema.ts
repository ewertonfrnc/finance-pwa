import { parseCalendarDate } from '../../lib/calendar-date'
import { parseCentavoDigits } from '../../lib/brl-money'

export type StartingPositionDirection = 'available' | 'negative'

export type StartingPositionFormInput = {
  amountDigits: string
  direction: StartingPositionDirection
  effectiveOn: string
}

export type StartingPositionPayload = {
  balance_cents: number
  effective_on: string
}

export type StartingPositionFieldErrors = Partial<
  Record<'amount' | 'effectiveOn', string>
>

export type StartingPositionValidationResult =
  | { errors: StartingPositionFieldErrors; ok: false }
  | { ok: true; payload: StartingPositionPayload }

const AMOUNT_ERROR = 'Informe um saldo válido.'
const DATE_ERROR = 'Escolha uma data válida para o ponto de partida.'

function isValidDirection(value: string): value is StartingPositionDirection {
  return value === 'available' || value === 'negative'
}

function parseMagnitude(amountDigits: string): number | null {
  if (amountDigits === '') return 0
  return parseCentavoDigits(amountDigits)
}

export function validateStartingPositionFormInput(
  input: StartingPositionFormInput,
): StartingPositionValidationResult {
  const errors: StartingPositionFieldErrors = {}

  if (!isValidDirection(input.direction)) {
    errors.amount = AMOUNT_ERROR
  }

  const magnitude = parseMagnitude(input.amountDigits)

  if (magnitude === null) {
    errors.amount = AMOUNT_ERROR
  }

  if (parseCalendarDate(input.effectiveOn) === null) {
    errors.effectiveOn = DATE_ERROR
  }

  if (Object.keys(errors).length > 0) {
    return { errors, ok: false }
  }

  const safeMagnitude = magnitude as number
  const balanceCents =
    safeMagnitude === 0
      ? 0
      : input.direction === 'negative'
        ? -safeMagnitude
        : safeMagnitude

  return {
    ok: true,
    payload: {
      balance_cents: balanceCents,
      effective_on: input.effectiveOn,
    },
  }
}

export const STARTING_POSITION_ERROR_COPY = {
  amountInvalid: AMOUNT_ERROR,
  dateInvalid: DATE_ERROR,
} as const
