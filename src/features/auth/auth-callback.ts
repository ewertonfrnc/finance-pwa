const EXPIRED_CALLBACK_CODES = new Set([
  'bad_code_verifier',
  'flow_state_expired',
  'flow_state_not_found',
  'otp_expired',
])

export type AuthCallbackFailure = 'denied' | 'expired' | 'invalid'

function readCallbackParameters(url: URL) {
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))

  return {
    error: fragment.get('error') ?? url.searchParams.get('error'),
    errorCode: fragment.get('error_code') ?? url.searchParams.get('error_code'),
    fragment,
  }
}

export function readAuthCallbackFailure(url: URL): AuthCallbackFailure | null {
  const { error, errorCode } = readCallbackParameters(url)

  if (errorCode && EXPIRED_CALLBACK_CODES.has(errorCode)) return 'expired'
  if (error === 'access_denied') return 'denied'
  if (error || errorCode) return 'invalid'

  return null
}

export function isPasswordRecoveryCallback(url: URL) {
  const { fragment } = readCallbackParameters(url)

  return (
    fragment.get('type') === 'recovery' &&
    fragment.has('access_token') &&
    fragment.has('refresh_token')
  )
}

export function cleanAuthCallbackUrl(url: URL) {
  window.history.replaceState(window.history.state, '', url.pathname)
}
