import { describe, expect, it } from 'vitest'

import {
  AUTH_ERROR_COPY,
  getLoginErrorCopy,
  getRegistrationErrorCopy,
  isExistingAccountError,
} from './auth-errors'

describe('getLoginErrorCopy', () => {
  it.each(['invalid_credentials', 'email_not_confirmed', 'user_banned'])(
    'should hide account details for %s',
    (code) => {
      expect(
        getLoginErrorCopy({
          code,
          message: 'Provider detail must stay hidden',
        }),
      ).toBe(AUTH_ERROR_COPY.invalidLogin)
    },
  )

  it('should hide unknown provider and network failures', () => {
    expect(
      getLoginErrorCopy({
        code: 'unexpected_provider_failure',
        message: 'Provider detail must stay hidden',
      }),
    ).toBe(AUTH_ERROR_COPY.generic)
    expect(getLoginErrorCopy(new TypeError('Failed to fetch'))).toBe(
      AUTH_ERROR_COPY.generic,
    )
  })
})

describe('registration error copy', () => {
  it.each(['weak_password', 'validation_failed'])(
    'should explain the password minimum for %s',
    (code) => {
      expect(
        getRegistrationErrorCopy({ code, message: 'Provider detail' }),
      ).toBe(AUTH_ERROR_COPY.registrationWeakPassword)
    },
  )

  it.each(['over_email_send_rate_limit', 'over_request_rate_limit'])(
    'should ask the visitor to wait for %s',
    (code) => {
      expect(
        getRegistrationErrorCopy({ code, message: 'Provider detail' }),
      ).toBe(AUTH_ERROR_COPY.registrationRateLimit)
    },
  )

  it('should hide provider details for an unknown registration failure', () => {
    expect(
      getRegistrationErrorCopy({
        code: 'unexpected_provider_failure',
        message: 'Provider detail must stay hidden',
      }),
    ).toBe(AUTH_ERROR_COPY.generic)
  })

  it('should identify an existing-account response without matching its message', () => {
    expect(
      isExistingAccountError({
        code: 'user_already_exists',
        message: 'Provider detail must stay hidden',
      }),
    ).toBe(true)
    expect(
      isExistingAccountError({
        code: 'unexpected_provider_failure',
        message: 'User already registered',
      }),
    ).toBe(false)
  })
})
