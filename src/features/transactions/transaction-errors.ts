import { TRANSACTION_DESCRIPTION_MAX_LENGTH } from './transaction-types'

export const TRANSACTION_ERROR_COPY = {
  amountOutOfRange: 'Informe um valor entre R$ 0,01 e o limite suportado.',
  amountRequired: 'Informe um valor maior que R$ 0,00.',
  authenticationRequired: 'Sua sessão expirou. Entre novamente para continuar.',
  dateOutOfRange: 'Escolha uma data válida para o lançamento.',
  descriptionTooLong: `A descrição pode ter no máximo ${TRANSACTION_DESCRIPTION_MAX_LENGTH} caracteres.`,
  generic: 'Não foi possível salvar o lançamento. Tente novamente.',
  idConflict:
    'Esse lançamento já foi enviado com dados diferentes. Recarregue e tente novamente.',
  idRequired:
    'Não foi possível identificar o lançamento. Recarregue e tente novamente.',
  kindRequired: 'Selecione o tipo do lançamento.',
  notFound: 'Lançamento não encontrado.',
  permissionDenied: 'Você não tem permissão para esta ação.',
  staleVersion:
    'Esse lançamento foi alterado em outro lugar. Recarregue para continuar.',
  versionRequired:
    'Não foi possível confirmar a versão do lançamento. Recarregue e tente novamente.',
} as const

// Keyed by the stable `${sqlstate}:${message}` pair the mutation RPCs raise.
// See docs/finance-rules.md "Error contract".
const KNOWN_TRANSACTION_ERRORS: Record<string, string> = {
  '22023:amount_cents_out_of_range': TRANSACTION_ERROR_COPY.amountOutOfRange,
  '22023:description_too_long': TRANSACTION_ERROR_COPY.descriptionTooLong,
  '22023:transaction_date_out_of_range': TRANSACTION_ERROR_COPY.dateOutOfRange,
  '22023:transaction_id_required': TRANSACTION_ERROR_COPY.idRequired,
  '22023:transaction_kind_required': TRANSACTION_ERROR_COPY.kindRequired,
  '22023:transaction_version_required': TRANSACTION_ERROR_COPY.versionRequired,
  '23505:transaction_id_conflict': TRANSACTION_ERROR_COPY.idConflict,
  '40001:transaction_conflict': TRANSACTION_ERROR_COPY.staleVersion,
  'P0002:transaction_not_found': TRANSACTION_ERROR_COPY.notFound,
}

function readTransactionErrorDetails(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof error.code !== 'string'
  ) {
    return null
  }

  const message =
    'message' in error && typeof error.message === 'string'
      ? error.message
      : null

  return { code: error.code, message }
}

// A stale version is the one failure with its own recovery path, so the UI
// asks the question instead of matching the raw sqlstate in a component.
export function isTransactionConflict(error: unknown) {
  const details = readTransactionErrorDetails(error)

  return details?.code === '40001' && details.message === 'transaction_conflict'
}

export function getTransactionErrorCopy(error: unknown) {
  const details = readTransactionErrorDetails(error)

  if (!details) return TRANSACTION_ERROR_COPY.generic

  if (details.code === '42501') {
    return details.message === 'authentication_required'
      ? TRANSACTION_ERROR_COPY.authenticationRequired
      : TRANSACTION_ERROR_COPY.permissionDenied
  }

  return (
    KNOWN_TRANSACTION_ERRORS[`${details.code}:${details.message ?? ''}`] ??
    TRANSACTION_ERROR_COPY.generic
  )
}
