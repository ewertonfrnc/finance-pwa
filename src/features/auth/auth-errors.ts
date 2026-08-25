const INVALID_LOGIN_CODES = new Set([
  'email_not_confirmed',
  'invalid_credentials',
  'user_banned',
])

const REGISTRATION_RATE_LIMIT_CODES = new Set([
  'over_email_send_rate_limit',
  'over_request_rate_limit',
])

const REGISTRATION_VALIDATION_CODES = new Set([
  'validation_failed',
  'weak_password',
])

export const AUTH_ERROR_COPY = {
  generic: 'Não foi possível concluir. Tente novamente.',
  invalidLogin: 'Email ou senha inválidos',
  logout: 'Não foi possível sair. Tente novamente.',
  registrationRateLimit:
    'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.',
  registrationWeakPassword: 'Use uma senha com pelo menos 8 caracteres.',
} as const

function readAuthErrorCode(error: unknown) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code
  }

  return null
}

export function getLoginErrorCopy(error: unknown) {
  const code = readAuthErrorCode(error)

  return code && INVALID_LOGIN_CODES.has(code)
    ? AUTH_ERROR_COPY.invalidLogin
    : AUTH_ERROR_COPY.generic
}

export function getRegistrationErrorCopy(error: unknown) {
  const code = readAuthErrorCode(error)

  if (code && REGISTRATION_VALIDATION_CODES.has(code)) {
    return AUTH_ERROR_COPY.registrationWeakPassword
  }

  if (code && REGISTRATION_RATE_LIMIT_CODES.has(code)) {
    return AUTH_ERROR_COPY.registrationRateLimit
  }

  return AUTH_ERROR_COPY.generic
}

export function isExistingAccountError(error: unknown) {
  return readAuthErrorCode(error) === 'user_already_exists'
}
