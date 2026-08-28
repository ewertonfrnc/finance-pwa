export const STARTING_POSITION_ERROR_COPY = {
  alreadyExists:
    'Um ponto de partida já foi salvo com outros valores. Atualize a página para ver o valor salvo.',
  authenticationRequired: 'Sua sessão expirou. Entre novamente para continuar.',
  balanceOutOfRange: 'Informe um saldo suportado.',
  dateOutOfRange: 'Escolha uma data válida para o ponto de partida.',
  generic: 'Não foi possível salvar o ponto de partida. Tente novamente.',
  permissionDenied: 'Você não tem permissão para esta ação.',
} as const

const KNOWN_STARTING_POSITION_ERRORS: Record<string, string> = {
  '22023:balance_cents_out_of_range':
    STARTING_POSITION_ERROR_COPY.balanceOutOfRange,
  '22023:effective_on_out_of_range':
    STARTING_POSITION_ERROR_COPY.dateOutOfRange,
  '23505:starting_position_already_exists':
    STARTING_POSITION_ERROR_COPY.alreadyExists,
}

function readStartingPositionErrorDetails(error: unknown) {
  if (
    typeof error !== 'object' ||
    error === null ||
    !('code' in error) ||
    typeof (error as { code: unknown }).code !== 'string'
  ) {
    return null
  }

  const message =
    'message' in error &&
    typeof (error as { message: unknown }).message === 'string'
      ? (error as { message: string }).message
      : null

  return { code: (error as { code: string }).code, message }
}

export function isStartingPositionAlreadyExists(error: unknown) {
  const details = readStartingPositionErrorDetails(error)
  return (
    details?.code === '23505' &&
    details.message === 'starting_position_already_exists'
  )
}

export function getStartingPositionErrorCopy(error: unknown) {
  const details = readStartingPositionErrorDetails(error)

  if (!details) return STARTING_POSITION_ERROR_COPY.generic

  if (details.code === '42501') {
    return details.message === 'authentication_required'
      ? STARTING_POSITION_ERROR_COPY.authenticationRequired
      : STARTING_POSITION_ERROR_COPY.permissionDenied
  }

  return (
    KNOWN_STARTING_POSITION_ERRORS[
      `${details.code}:${details.message ?? ''}`
    ] ?? STARTING_POSITION_ERROR_COPY.generic
  )
}
