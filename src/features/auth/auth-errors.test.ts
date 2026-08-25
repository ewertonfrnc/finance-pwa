import { describe, expect, it } from 'vitest'

import { AUTH_ERROR_COPY, getLoginErrorCopy } from './auth-errors'

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
