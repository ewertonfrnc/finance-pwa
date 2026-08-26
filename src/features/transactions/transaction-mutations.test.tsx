import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from './transaction-types'

const transactionMocks = vi.hoisted(() => ({
  createTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
}))

vi.mock('./transaction-service', () => ({
  createTransaction: transactionMocks.createTransaction,
}))

import { transactionQueryKeys } from './transaction-queries'
import { useCreateTransaction } from './transaction-mutations'

function noop() {}

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    amount_cents: 5000,
    created_at: '2026-08-25T12:00:00Z',
    description: null,
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'expense',
    transaction_date: '2026-08-25',
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
    ...overrides,
  }
}

function renderCreateTransaction(userId = 'user-a') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  const view = renderHook(() => useCreateTransaction(userId), { wrapper })

  return { ...view, invalidateQueries, queryClient }
}

describe('useCreateTransaction', () => {
  beforeEach(() => {
    transactionMocks.createTransaction.mockReset()
  })

  it('should invalidate the month of the persisted transaction date', async () => {
    transactionMocks.createTransaction.mockResolvedValue(
      transaction({ transaction_date: '2026-08-25' }),
    )
    const { invalidateQueries, result } = renderCreateTransaction('user-a')

    result.current.mutate({
      amountCents: 5000,
      description: null,
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'expense',
      transactionDate: '2026-08-25',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
      refetchType: 'all',
    })
  })

  it('should refetch the destination month before it resolves, even unmounted', async () => {
    transactionMocks.createTransaction.mockResolvedValue(
      transaction({ transaction_date: '2026-08-25' }),
    )
    const { queryClient, result } = renderCreateTransaction('user-a')
    const readMonth = vi
      .fn<() => Promise<Transaction[]>>()
      .mockResolvedValue([])

    // The workspace list is unmounted while the form is open, so its month
    // query has no observer when the create succeeds.
    await queryClient.prefetchQuery({
      queryFn: readMonth,
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
    })
    expect(readMonth).toHaveBeenCalledTimes(1)

    result.current.mutate({
      amountCents: 5000,
      description: null,
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'expense',
      transactionDate: '2026-08-25',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(readMonth).toHaveBeenCalledTimes(2)
  })

  it('should invalidate the returned month even when it differs from the submitted date', async () => {
    transactionMocks.createTransaction.mockResolvedValue(
      transaction({ transaction_date: '2026-09-01' }),
    )
    const { invalidateQueries, result } = renderCreateTransaction('user-a')

    result.current.mutate({
      amountCents: 5000,
      description: null,
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'expense',
      transactionDate: '2026-08-31',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-09'),
      refetchType: 'all',
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
      refetchType: 'all',
    })
  })

  it('should stay pending until the month invalidation finishes', async () => {
    transactionMocks.createTransaction.mockResolvedValue(transaction())
    const { invalidateQueries, result } = renderCreateTransaction('user-a')
    let resolveInvalidation: () => void = noop
    invalidateQueries.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvalidation = resolve
        }),
    )

    result.current.mutate({
      amountCents: 5000,
      description: null,
      id: '00000000-0000-4000-8000-000000000001',
      kind: 'expense',
      transactionDate: '2026-08-25',
    })

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled())
    expect(result.current.isPending).toBe(true)

    resolveInvalidation()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
