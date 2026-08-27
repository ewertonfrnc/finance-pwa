import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from './transaction-types'

const transactionMocks = vi.hoisted(() => ({
  createTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
  deleteTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
  updateTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
}))

vi.mock('./transaction-service', () => ({
  createTransaction: transactionMocks.createTransaction,
  deleteTransaction: transactionMocks.deleteTransaction,
  updateTransaction: transactionMocks.updateTransaction,
}))

import { transactionQueryKeys } from './transaction-queries'
import {
  useCreateTransaction,
  useDeleteTransaction,
  useUpdateTransaction,
} from './transaction-mutations'

function noop() {}

function updateVariables(overrides: Record<string, unknown> = {}) {
  return {
    amountCents: 7500,
    description: null,
    expectedUpdatedAt: '2026-08-25T12:00:00Z',
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'expense' as const,
    originalMonth: '2026-08',
    transactionDate: '2026-08-25',
    ...overrides,
  }
}

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

function renderMutation<T>(hook: () => T, userId = 'user-a') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }

  const view = renderHook(hook, { wrapper })

  return { ...view, invalidateQueries, queryClient, userId }
}

function renderUpdateTransaction(userId = 'user-a') {
  return renderMutation(() => useUpdateTransaction(userId), userId)
}

function renderCreateTransaction(userId = 'user-a') {
  return renderMutation(() => useCreateTransaction(userId), userId)
}

function renderDeleteTransaction(userId = 'user-a') {
  return renderMutation(() => useDeleteTransaction(userId), userId)
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

describe('useUpdateTransaction', () => {
  beforeEach(() => {
    transactionMocks.updateTransaction.mockReset()
  })

  it('should invalidate only the month of an edit that kept its date', async () => {
    transactionMocks.updateTransaction.mockResolvedValue(
      transaction({ amount_cents: 7500 }),
    )
    const { invalidateQueries, result } = renderUpdateTransaction()

    result.current.mutate(updateVariables())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateQueries).toHaveBeenCalledTimes(1)
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
      refetchType: 'all',
    })
  })

  it('should invalidate both the original and the destination month of a moved row', async () => {
    transactionMocks.updateTransaction.mockResolvedValue(
      transaction({ transaction_date: '2026-09-02' }),
    )
    const { invalidateQueries, result } = renderUpdateTransaction()

    result.current.mutate(updateVariables({ transactionDate: '2026-09-02' }))

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
      refetchType: 'all',
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-09'),
      refetchType: 'all',
    })
    expect(invalidateQueries).not.toHaveBeenCalledWith(
      expect.objectContaining({
        queryKey: transactionQueryKeys.detail(
          'user-a',
          '00000000-0000-4000-8000-000000000001',
        ),
      }),
    )
  })

  it('should leave the persisted row as the cached detail', async () => {
    const persisted = transaction({ amount_cents: 7500 })
    transactionMocks.updateTransaction.mockResolvedValue(persisted)
    const { queryClient, result } = renderUpdateTransaction()

    result.current.mutate(updateVariables())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(
      queryClient.getQueryData(
        transactionQueryKeys.detail('user-a', persisted.id),
      ),
    ).toEqual(persisted)
  })

  it('should send the expected version to the service', async () => {
    transactionMocks.updateTransaction.mockResolvedValue(transaction())
    const { result } = renderUpdateTransaction()

    result.current.mutate(updateVariables())

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(transactionMocks.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: '00000000-0000-4000-8000-000000000001',
      }),
    )
  })

  it('should stay pending until every affected month finishes refetching', async () => {
    transactionMocks.updateTransaction.mockResolvedValue(transaction())
    const { invalidateQueries, result } = renderUpdateTransaction()
    let resolveInvalidation: () => void = noop
    invalidateQueries.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvalidation = resolve
        }),
    )

    result.current.mutate(updateVariables())

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled())
    expect(result.current.isPending).toBe(true)

    resolveInvalidation()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})

describe('useDeleteTransaction', () => {
  beforeEach(() => {
    transactionMocks.deleteTransaction.mockReset()
  })

  it('should remove the detail query and invalidate the deleted month', async () => {
    transactionMocks.deleteTransaction.mockResolvedValue(
      transaction({ transaction_date: '2026-08-25' }),
    )
    const { queryClient, result } = renderDeleteTransaction('user-a')
    const removeQueries = vi.spyOn(queryClient, 'removeQueries')
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')

    // Seed the detail query so removal is observable.
    queryClient.setQueryData(
      transactionQueryKeys.detail(
        'user-a',
        '00000000-0000-4000-8000-000000000001',
      ),
      transaction(),
    )
    expect(
      queryClient.getQueryData(
        transactionQueryKeys.detail(
          'user-a',
          '00000000-0000-4000-8000-000000000001',
        ),
      ),
    ).toBeDefined()

    result.current.mutate({
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: '00000000-0000-4000-8000-000000000001',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(removeQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.detail(
        'user-a',
        '00000000-0000-4000-8000-000000000001',
      ),
    })
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: transactionQueryKeys.month('user-a', '2026-08'),
      refetchType: 'all',
    })
    expect(
      queryClient.getQueryData(
        transactionQueryKeys.detail(
          'user-a',
          '00000000-0000-4000-8000-000000000001',
        ),
      ),
    ).toBeUndefined()
  })

  it('should send the expected version to the service', async () => {
    transactionMocks.deleteTransaction.mockResolvedValue(transaction())
    const { result } = renderDeleteTransaction()

    result.current.mutate({
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: '00000000-0000-4000-8000-000000000001',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(transactionMocks.deleteTransaction).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: '00000000-0000-4000-8000-000000000001',
    })
  })

  it('should stay pending until the month invalidation finishes', async () => {
    transactionMocks.deleteTransaction.mockResolvedValue(transaction())
    const { queryClient, result } = renderDeleteTransaction()
    const invalidateQueries = vi.spyOn(queryClient, 'invalidateQueries')
    let resolveInvalidation: () => void = noop
    invalidateQueries.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveInvalidation = resolve
        }),
    )

    result.current.mutate({
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: '00000000-0000-4000-8000-000000000001',
    })

    await waitFor(() => expect(invalidateQueries).toHaveBeenCalled())
    expect(result.current.isPending).toBe(true)

    resolveInvalidation()

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
  })
})
