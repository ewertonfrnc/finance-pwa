import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DailySpendingSetting } from './daily-spending-types'

type SingleResult = {
  data: DailySpendingSetting | null
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
      ) => Promise<{ data: DailySpendingSetting | null; error: unknown }>
    >(),
    singleResults,
  }
})

vi.mock('../../lib/supabase/client', () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}))

import {
  readDailySpendingSetting,
  setDailySpending,
} from './daily-spending-service'

function dailySpendingSetting(
  overrides: Partial<DailySpendingSetting> = {},
): DailySpendingSetting {
  return {
    created_at: '2026-09-02T12:00:00Z',
    daily_amount_cents: 5000,
    days_per_month: 30,
    monthly_amount_cents: 150000,
    updated_at: '2026-09-02T12:00:00Z',
    user_id: 'user-a',
    ...overrides,
  }
}

describe('daily-spending service', () => {
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

  describe('readDailySpendingSetting', () => {
    it('should read a single owned row with the caller signal and no user_id filter', async () => {
      const row = dailySpendingSetting()
      supabaseMocks.singleResults.push({ data: row, error: null })
      const signal = new AbortController().signal

      await expect(readDailySpendingSetting({ signal })).resolves.toEqual(row)

      expect(supabaseMocks.from).toHaveBeenCalledWith('daily_spending_settings')
      expect(supabaseMocks.builder.select).toHaveBeenCalledWith('*')
      expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledWith(signal)
      expect(supabaseMocks.builder.maybeSingle).toHaveBeenCalledTimes(1)
      // RLS decides visibility, so the query never filters by user_id.
    })

    it('should return null when no setting exists for this user, distinct from a zero setting', async () => {
      supabaseMocks.singleResults.push({ data: null, error: null })

      await expect(
        readDailySpendingSetting({ signal: new AbortController().signal }),
      ).resolves.toBeNull()
    })

    it('should return an explicit zero setting rather than treating it as absent', async () => {
      const zeroSetting = dailySpendingSetting({
        daily_amount_cents: 0,
        monthly_amount_cents: 0,
      })
      supabaseMocks.singleResults.push({ data: zeroSetting, error: null })

      await expect(
        readDailySpendingSetting({ signal: new AbortController().signal }),
      ).resolves.toEqual(zeroSetting)
    })

    it('should surface a provider failure for safe UI mapping', async () => {
      const providerError = new Error('Provider detail')
      supabaseMocks.singleResults.push({ data: null, error: providerError })

      await expect(
        readDailySpendingSetting({ signal: new AbortController().signal }),
      ).rejects.toBe(providerError)
    })
  })

  describe('setDailySpending', () => {
    it('should call the RPC with only the three documented keys', async () => {
      const row = dailySpendingSetting()
      supabaseMocks.rpc.mockResolvedValue({ data: row, error: null })

      await expect(
        setDailySpending({
          daysPerMonth: 30,
          expectedUpdatedAt: null,
          monthlyAmountCents: 150000,
        }),
      ).resolves.toEqual(row)

      expect(supabaseMocks.rpc).toHaveBeenCalledWith('set_daily_spending', {
        p_days_per_month: 30,
        p_expected_updated_at: null,
        p_monthly_amount_cents: 150000,
      })
      const args = supabaseMocks.rpc.mock.calls[0][1] as Record<string, unknown>
      expect(Object.keys(args).toSorted()).toEqual([
        'p_days_per_month',
        'p_expected_updated_at',
        'p_monthly_amount_cents',
      ])
    })

    it('should send the exact expected version for an edit', async () => {
      const row = dailySpendingSetting({
        updated_at: '2026-09-02T13:00:00Z',
      })
      supabaseMocks.rpc.mockResolvedValue({ data: row, error: null })

      await setDailySpending({
        daysPerMonth: 30,
        expectedUpdatedAt: '2026-09-02T12:00:00Z',
        monthlyAmountCents: 150000,
      })

      expect(supabaseMocks.rpc).toHaveBeenCalledWith('set_daily_spending', {
        p_days_per_month: 30,
        p_expected_updated_at: '2026-09-02T12:00:00Z',
        p_monthly_amount_cents: 150000,
      })
    })

    it('should surface a provider failure for safe UI mapping', async () => {
      const providerError = {
        code: 'PT409',
        message: 'daily_spending_conflict',
      }
      supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

      await expect(
        setDailySpending({
          daysPerMonth: 30,
          expectedUpdatedAt: null,
          monthlyAmountCents: 150000,
        }),
      ).rejects.toBe(providerError)
    })
  })
})
