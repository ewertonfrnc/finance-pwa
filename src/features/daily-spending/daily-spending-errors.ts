export const DAILY_SPENDING_ERROR_COPY = {
  authenticationRequired: 'Sua sessão expirou. Entre novamente para continuar.',
  conflict:
    'Seu diário foi alterado em outro lugar. Recarregue para continuar.',
  daysPerMonthOutOfRange: 'Escolha um divisor entre 28 e 31 dias.',
  generic: 'Não foi possível salvar o diário. Tente novamente.',
  monthlyAmountOutOfRange: 'Informe um valor suportado.',
  permissionDenied: 'Você não tem permissão para esta ação.',
} as const

// Keyed by the stable `${sqlstate}:${message}` pair set_daily_spending
// raises. See docs/finance-rules.md "Daily spending setting" and "Error
// contract". This table intentionally does not have a 40001 fallback: unlike
// the transaction mutation RPCs, daily_spending_settings shipped with PT409
// from its first migration and never emitted 40001.
const KNOWN_DAILY_SPENDING_ERRORS: Record<string, string> = {
  '22023:days_per_month_out_of_range':
    DAILY_SPENDING_ERROR_COPY.daysPerMonthOutOfRange,
  '22023:monthly_amount_cents_out_of_range':
    DAILY_SPENDING_ERROR_COPY.monthlyAmountOutOfRange,
  'PT409:daily_spending_conflict': DAILY_SPENDING_ERROR_COPY.conflict,
}

function readDailySpendingErrorDetails(error: unknown) {
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

export function isDailySpendingConflict(error: unknown) {
  const details = readDailySpendingErrorDetails(error)

  return (
    details?.code === 'PT409' && details.message === 'daily_spending_conflict'
  )
}

export function getDailySpendingErrorCopy(error: unknown) {
  const details = readDailySpendingErrorDetails(error)

  if (!details) return DAILY_SPENDING_ERROR_COPY.generic

  if (details.code === '42501') {
    return details.message === 'authentication_required'
      ? DAILY_SPENDING_ERROR_COPY.authenticationRequired
      : DAILY_SPENDING_ERROR_COPY.permissionDenied
  }

  return (
    KNOWN_DAILY_SPENDING_ERRORS[`${details.code}:${details.message ?? ''}`] ??
    DAILY_SPENDING_ERROR_COPY.generic
  )
}
