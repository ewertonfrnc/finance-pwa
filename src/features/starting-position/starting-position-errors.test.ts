import { describe, expect, it } from 'vitest'

import {
  STARTING_POSITION_ERROR_COPY,
  getStartingPositionErrorCopy,
  isStartingPositionAlreadyExists,
} from './starting-position-errors'

describe('getStartingPositionErrorCopy', () => {
  it.each([
    [
      '22023',
      'balance_cents_out_of_range',
      STARTING_POSITION_ERROR_COPY.balanceOutOfRange,
    ],
    [
      '22023',
      'effective_on_out_of_range',
      STARTING_POSITION_ERROR_COPY.dateOutOfRange,
    ],
    [
      '23505',
      'starting_position_already_exists',
      STARTING_POSITION_ERROR_COPY.alreadyExists,
    ],
    [
      '42501',
      'authentication_required',
      STARTING_POSITION_ERROR_COPY.authenticationRequired,
    ],
  ] satisfies [string, string, string][])(
    'should translate %s %s into safe copy',
    (code, message, expected) => {
      expect(getStartingPositionErrorCopy({ code, message })).toBe(expected)
    },
  )

  it('should hide an unrelated privilege denial behind generic permission copy', () => {
    expect(
      getStartingPositionErrorCopy({
        code: '42501',
        message: 'permission denied for table starting_positions',
      }),
    ).toBe(STARTING_POSITION_ERROR_COPY.permissionDenied)
  })

  it('should hide an unknown error behind generic retry copy without leaking its message', () => {
    expect(
      getStartingPositionErrorCopy({
        code: 'unexpected_provider_failure',
        message: 'insert into public.starting_positions ... policy violated',
      }),
    ).toBe(STARTING_POSITION_ERROR_COPY.generic)
  })

  it('should not throw for an error without a code', () => {
    expect(getStartingPositionErrorCopy(new Error('Failed to fetch'))).toBe(
      STARTING_POSITION_ERROR_COPY.generic,
    )
    expect(getStartingPositionErrorCopy(null)).toBe(
      STARTING_POSITION_ERROR_COPY.generic,
    )
    expect(getStartingPositionErrorCopy(undefined)).toBe(
      STARTING_POSITION_ERROR_COPY.generic,
    )
  })

  it('should distinguish an existing different position from other errors', () => {
    expect(
      isStartingPositionAlreadyExists({
        code: '23505',
        message: 'starting_position_already_exists',
      }),
    ).toBe(true)
  })

  it('should not treat a matching code with a different message as already exists', () => {
    expect(
      isStartingPositionAlreadyExists({
        code: '23505',
        message: 'unexpected',
      }),
    ).toBe(false)
  })

  it('should not recognize an unrelated error as already exists', () => {
    expect(
      isStartingPositionAlreadyExists({
        code: '22023',
        message: 'balance_cents_out_of_range',
      }),
    ).toBe(false)
    expect(isStartingPositionAlreadyExists(new Error('Failed to fetch'))).toBe(
      false,
    )
    expect(isStartingPositionAlreadyExists(null)).toBe(false)
  })
})
