import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { StartingPosition } from './starting-position-types'

type SingleResult = {
  data: StartingPosition | null
  error: unknown
}

const supabaseMocks = vi.hoisted(() => {
  const singleResults: SingleResult[] = []
  const builder = {
    abortSignal: vi.fn<(signal: AbortSignal) => unknown>(),
    maybeSingle: vi.fn<() => Promise<SingleResult>>(),
    select: vi.fn<(columns?: string) => unknown>(),
  }

  builder.select.mockReturnValue(builder)
  builder.abortSignal.mockImplementation(() => {
    return {
      maybeSingle: builder.maybeSingle,
    }
  })
  builder.maybeSingle.mockImplementation(async () => {
    const result = singleResults.shift()
    if (!result) throw new Error('Missing mocked Data API row.')
    return result
  })

  return {
    builder,
    from: vi.fn<(table: string) => unknown>(() => builder),
    rpc: vi.fn<
      (
        fn: string,
        args: unknown,
      ) => Promise<{ data: StartingPosition | null; error: unknown }>
    >(),
    singleResults,
  }
})

vi.mock('../../lib/supabase/client', () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}))

import {
  initializeStartingPosition,
  readStartingPosition,
} from './starting-position-service'

function startingPosition(
  overrides: Partial<StartingPosition> = {},
): StartingPosition {
  return {
    balance_cents: 5000,
    created_at: '2026-08-26T12:00:00Z',
    effective_on: '2026-08-26',
    user_id: 'user-a',
    ...overrides,
  }
}

describe('starting-position service', () => {
  beforeEach(() => {
    supabaseMocks.singleResults.length = 0
    supabaseMocks.from.mockClear()
    supabaseMocks.rpc.mockClear()
    for (const mock of Object.values(supabaseMocks.builder)) mock.mockClear()
    supabaseMocks.builder.select.mockReturnValue(supabaseMocks.builder)
    supabaseMocks.builder.abortSignal.mockImplementation(() => {
      return {
        maybeSingle: supabaseMocks.builder.maybeSingle,
      }
    })
  })

  describe('readStartingPosition', () => {
    it('should read a single owned row with the caller signal', async () => {
      const row = startingPosition()
      supabaseMocks.singleResults.push({ data: row, error: null })
      const signal = new AbortController().signal

      await expect(readStartingPosition({ signal })).resolves.toEqual(row)

      expect(supabaseMocks.from).toHaveBeenCalledWith('starting_positions')
      expect(supabaseMocks.builder.select).toHaveBeenCalledWith('*')
      expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledWith(signal)
      expect(supabaseMocks.builder.maybeSingle).toHaveBeenCalledTimes(1)
      // No user_id filter — RLS decides visibility.
      // The builder has no eq method; ensuring from->select->abortSignal->maybeSingle chain.
    })

    it('should return null when no row exists for this user', async () => {
      supabaseMocks.singleResults.push({ data: null, error: null })

      await expect(
        readStartingPosition({ signal: new AbortController().signal }),
      ).resolves.toBeNull()
    })

    it('should forward the caller AbortSignal', async () => {
      supabaseMocks.singleResults.push({ data: null, error: null })
      const signal = new AbortController().signal

      await readStartingPosition({ signal })

      expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledWith(signal)
    })

    it('should surface a provider failure for safe UI mapping', async () => {
      const providerError = new Error('Provider detail')
      supabaseMocks.singleResults.push({ data: null, error: providerError })

      await expect(
        readStartingPosition({ signal: new AbortController().signal }),
      ).rejects.toBe(providerError)
    })
  })

  describe('initializeStartingPosition', () => {
    it('should call the RPC with only p_balance_cents and p_effective_on', async () => {
      const row = startingPosition({
        balance_cents: -5000,
        effective_on: '2026-08-26',
      })
      supabaseMocks.rpc.mockResolvedValue({ data: row, error: null })

      await expect(
        initializeStartingPosition({
          balanceCents: -5000,
          effectiveOn: '2026-08-26',
        }),
      ).resolves.toEqual(row)

      expect(supabaseMocks.rpc).toHaveBeenCalledWith(
        'initialize_starting_position',
        {
          p_balance_cents: -5000,
          p_effective_on: '2026-08-26',
        },
      )
      // Ensure no extra keys are sent.
      const args = supabaseMocks.rpc.mock.calls[0][1] as Record<string, unknown>
      expect(Object.keys(args).toSorted()).toEqual([
        'p_balance_cents',
        'p_effective_on',
      ])
    })

    it('should surface a provider failure for safe UI mapping', async () => {
      const providerError = {
        code: '23505',
        message: 'starting_position_already_exists',
      }
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

      await expect(
        initializeStartingPosition({
          balanceCents: 5000,
          effectiveOn: '2026-08-26',
        }),
      ).rejects.toBe(providerError)
    })
  })
})
