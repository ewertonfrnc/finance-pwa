const INVALID_LOGIN_CODES = new Set([
  'email_not_confirmed',
  'invalid_credentials',
  'user_banned',
])

export const AUTH_ERROR_COPY = {
  generic: 'Não foi possível concluir. Tente novamente.',
  invalidLogin: 'Email ou senha inválidos',
  logout: 'Não foi possível sair. Tente novamente.',
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
