import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { DailySpendingSetting } from './daily-spending-types'

const dailySpendingMocks = vi.hoisted(() => ({
  setDailySpending: vi.fn<(input: unknown) => Promise<DailySpendingSetting>>(),
}))

vi.mock('./daily-spending-service', () => ({
  setDailySpending: dailySpendingMocks.setDailySpending,
}))

import { dailySpendingQueryKeys } from './daily-spending-queries'
import { useSetDailySpending } from './daily-spending-mutations'

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

function renderSetDailySpending(userId = 'user-a') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  const view = renderHook(() => useSetDailySpending(userId), { wrapper })

  return { ...view, queryClient, userId }
}

describe('useSetDailySpending', () => {
  beforeEach(() => {
    dailySpendingMocks.setDailySpending.mockReset()
  })

  it('should write the persisted row into the exact user-scoped query key', async () => {
    const persisted = dailySpendingSetting()
    dailySpendingMocks.setDailySpending.mockResolvedValue(persisted)
    const { queryClient, result } = renderSetDailySpending('user-a')

    result.current.mutate({
      daysPerMonth: 30,
      expectedUpdatedAt: null,
      monthlyAmountCents: 150000,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      queryClient.getQueryData(dailySpendingQueryKeys.byUser('user-a')),
    ).toEqual(persisted)
  })

  it('should forward the mutation variables to the service unchanged', async () => {
    dailySpendingMocks.setDailySpending.mockResolvedValue(
      dailySpendingSetting(),
    )
    const { result } = renderSetDailySpending()

    result.current.mutate({
      daysPerMonth: 28,
      expectedUpdatedAt: '2026-09-02T12:00:00Z',
      monthlyAmountCents: 90000,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(dailySpendingMocks.setDailySpending.mock.calls[0][0]).toEqual({
      daysPerMonth: 28,
      expectedUpdatedAt: '2026-09-02T12:00:00Z',
      monthlyAmountCents: 90000,
    })
  })

  it('should not write to another user query key', async () => {
    const persisted = dailySpendingSetting()
    dailySpendingMocks.setDailySpending.mockResolvedValue(persisted)
    const { queryClient, result } = renderSetDailySpending('user-a')

    result.current.mutate({
      daysPerMonth: 30,
      expectedUpdatedAt: null,
      monthlyAmountCents: 150000,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      queryClient.getQueryData(dailySpendingQueryKeys.byUser('user-b')),
    ).toBeUndefined()
  })
})
