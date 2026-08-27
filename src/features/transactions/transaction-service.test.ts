import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from './transaction-types'

type PageResult = {
  data: Transaction[] | null
  error: unknown
}

const supabaseMocks = vi.hoisted(() => {
  const pageResults: PageResult[] = []
  const singleResults: { data: Transaction | null; error: unknown }[] = []
  const builder = {
    abortSignal: vi.fn<(signal: AbortSignal) => unknown>(),
    eq: vi.fn<(column: string, value: string) => unknown>(),
    gte: vi.fn<(column: string, value: string) => unknown>(),
    maybeSingle:
      vi.fn<() => Promise<{ data: Transaction | null; error: unknown }>>(),
    lt: vi.fn<(column: string, value: string) => unknown>(),
    lte: vi.fn<(column: string, value: string) => unknown>(),
    order:
      vi.fn<(column: string, options: { ascending: boolean }) => unknown>(),
    range: vi.fn<(from: number, to: number) => unknown>(),
    select: vi.fn<(columns?: string) => unknown>(),
  }

  builder.select.mockReturnValue(builder)
  builder.eq.mockReturnValue(builder)
  builder.gte.mockReturnValue(builder)
  builder.lt.mockReturnValue(builder)
  builder.lte.mockReturnValue(builder)
  builder.order.mockReturnValue(builder)
  builder.range.mockReturnValue(builder)
  // abortSignal is the last modifier in both reads: the monthly query awaits
  // it directly, while the single-row query still calls maybeSingle after it.
  builder.abortSignal.mockImplementation(() => {
    const result = pageResults.shift() ?? {
      data: null,
      error: new Error('Missing mocked Data API page.'),
    }

    return Object.assign(Promise.resolve(result), {
      maybeSingle: builder.maybeSingle,
    })
  })
  builder.maybeSingle.mockImplementation(async () => {
    const result = singleResults.shift()

    if (!result) throw new Error('Missing mocked Data API row.')

    return result
  })

  return {
    builder,
    from: vi.fn<(table: string) => unknown>(() => builder),
    pageResults,
    singleResults,
    rpc: vi.fn<
      (
        fn: string,
        args: unknown,
      ) => Promise<{ data: Transaction | null; error: unknown }>
    >(),
  }
})

vi.mock('../../lib/supabase/client', () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}))

import {
  createTransaction,
  deleteTransaction,
  readMonthlyTransactions,
  readTransaction,
  updateTransaction,
} from './transaction-service'

function transaction(index: number): Transaction {
  return {
    amount_cents: index + 1,
    created_at: `2026-08-25T12:${String(index % 60).padStart(2, '0')}:00Z`,
    description: `Transaction ${index}`,
    id: `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`,
    kind: index % 2 === 0 ? 'income' : 'expense',
    transaction_date: '2026-08-25',
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
  }
}

describe('transaction service', () => {
  beforeEach(() => {
    supabaseMocks.pageResults.length = 0
    supabaseMocks.singleResults.length = 0
    supabaseMocks.from.mockClear()
    supabaseMocks.rpc.mockClear()

    for (const mock of Object.values(supabaseMocks.builder)) mock.mockClear()
  })

  it('should read every ordered monthly page with the caller signal', async () => {
    const transactions = Array.from({ length: 201 }, (_, index) =>
      transaction(index),
    )
    supabaseMocks.pageResults.push(
      { data: transactions.slice(0, 200), error: null },
      { data: transactions.slice(200), error: null },
    )
    const signal = new AbortController().signal

    await expect(
      readMonthlyTransactions({ month: '2026-08', signal }),
    ).resolves.toEqual(transactions)

    expect(supabaseMocks.from).toHaveBeenCalledTimes(2)
    expect(supabaseMocks.from).toHaveBeenCalledWith('transactions')
    expect(supabaseMocks.builder.gte).toHaveBeenCalledWith(
      'transaction_date',
      '2026-08-01',
    )
    expect(supabaseMocks.builder.lt).toHaveBeenCalledWith(
      'transaction_date',
      '2026-09-01',
    )
    expect(supabaseMocks.builder.order.mock.calls).toEqual([
      ['transaction_date', { ascending: false }],
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
      ['transaction_date', { ascending: false }],
      ['created_at', { ascending: false }],
      ['id', { ascending: false }],
    ])
    expect(supabaseMocks.builder.range.mock.calls).toEqual([
      [0, 199],
      [200, 399],
    ])
    expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledTimes(2)
    expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('should use the supported final date for December 9999', async () => {
    supabaseMocks.pageResults.push({ data: [], error: null })

    await readMonthlyTransactions({
      month: '9999-12',
      signal: new AbortController().signal,
    })

    expect(supabaseMocks.builder.lte).toHaveBeenCalledWith(
      'transaction_date',
      '9999-12-31',
    )
    expect(supabaseMocks.builder.lt).not.toHaveBeenCalled()
  })

  it('should surface a provider failure for safe UI mapping', async () => {
    const providerError = new Error('Provider detail')
    supabaseMocks.pageResults.push({ data: null, error: providerError })

    await expect(
      readMonthlyTransactions({
        month: '2026-08',
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(providerError)
  })
})

describe('createTransaction', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockClear()
  })

  it('should call the create_transaction RPC with the typed arguments', async () => {
    const persisted = transaction(0)
    supabaseMocks.rpc.mockResolvedValue({ data: persisted, error: null })

    await expect(
      createTransaction({
        amountCents: 5000,
        description: 'Mercado',
        id: persisted.id,
        kind: 'expense',
        transactionDate: '2026-08-25',
      }),
    ).resolves.toEqual(persisted)

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('create_transaction', {
      p_amount_cents: 5000,
      p_description: 'Mercado',
      p_id: persisted.id,
      p_kind: 'expense',
      p_transaction_date: '2026-08-25',
    })
  })

  it('should send an empty description instead of null', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: transaction(0), error: null })

    await createTransaction({
      amountCents: 5000,
      description: null,
      id: '00000000-0000-4000-8000-000000000000',
      kind: 'income',
      transactionDate: '2026-08-25',
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'create_transaction',
      expect.objectContaining({ p_description: '' }),
    )
  })

  it('should surface a provider failure for safe UI mapping', async () => {
    const providerError = { code: '23505', message: 'transaction_id_conflict' }
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

    await expect(
      createTransaction({
        amountCents: 5000,
        description: null,
        id: '00000000-0000-4000-8000-000000000000',
        kind: 'income',
        transactionDate: '2026-08-25',
      }),
    ).rejects.toBe(providerError)
  })
})

describe('readTransaction', () => {
  beforeEach(() => {
    supabaseMocks.singleResults.length = 0
    supabaseMocks.from.mockClear()

    for (const mock of Object.values(supabaseMocks.builder)) mock.mockClear()
  })

  it('should read a single owned row with the caller signal', async () => {
    const persisted = transaction(0)
    supabaseMocks.singleResults.push({ data: persisted, error: null })
    const signal = new AbortController().signal

    await expect(
      readTransaction({ id: persisted.id, signal }),
    ).resolves.toEqual(persisted)

    expect(supabaseMocks.from).toHaveBeenCalledWith('transactions')
    expect(supabaseMocks.builder.eq).toHaveBeenCalledWith('id', persisted.id)
    expect(supabaseMocks.builder.abortSignal).toHaveBeenCalledWith(signal)
  })

  it('should return null when RLS hides the row from this user', async () => {
    supabaseMocks.singleResults.push({ data: null, error: null })

    await expect(
      readTransaction({
        id: '00000000-0000-4000-8000-000000000000',
        signal: new AbortController().signal,
      }),
    ).resolves.toBeNull()
  })

  it('should surface a provider failure for safe UI mapping', async () => {
    const providerError = new Error('Provider detail')
    supabaseMocks.singleResults.push({ data: null, error: providerError })

    await expect(
      readTransaction({
        id: '00000000-0000-4000-8000-000000000000',
        signal: new AbortController().signal,
      }),
    ).rejects.toBe(providerError)
  })
})

describe('updateTransaction', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockClear()
  })

  it('should send the expected version with the typed arguments', async () => {
    const persisted = transaction(0)
    supabaseMocks.rpc.mockResolvedValue({ data: persisted, error: null })

    await expect(
      updateTransaction({
        amountCents: 7500,
        description: 'Mercado',
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: persisted.id,
        kind: 'expense',
        transactionDate: '2026-08-26',
      }),
    ).resolves.toEqual(persisted)

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('update_transaction', {
      p_amount_cents: 7500,
      p_description: 'Mercado',
      p_expected_updated_at: '2026-08-25T12:00:00Z',
      p_id: persisted.id,
      p_kind: 'expense',
      p_transaction_date: '2026-08-26',
    })
  })

  it('should send an empty description instead of null', async () => {
    supabaseMocks.rpc.mockResolvedValue({ data: transaction(0), error: null })

    await updateTransaction({
      amountCents: 7500,
      description: null,
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: '00000000-0000-4000-8000-000000000000',
      kind: 'income',
      transactionDate: '2026-08-26',
    })

    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'update_transaction',
      expect.objectContaining({ p_description: '' }),
    )
  })

  it('should surface a stale version failure for safe UI mapping', async () => {
    const providerError = { code: '40001', message: 'transaction_conflict' }
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

    await expect(
      updateTransaction({
        amountCents: 7500,
        description: null,
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: '00000000-0000-4000-8000-000000000000',
        kind: 'income',
        transactionDate: '2026-08-26',
      }),
    ).rejects.toBe(providerError)
  })
})

describe('deleteTransaction', () => {
  beforeEach(() => {
    supabaseMocks.rpc.mockClear()
  })

  it('should send the expected version with the typed arguments', async () => {
    const persisted = transaction(0)
    supabaseMocks.rpc.mockResolvedValue({ data: persisted, error: null })

    await expect(
      deleteTransaction({
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: persisted.id,
      }),
    ).resolves.toEqual(persisted)

    expect(supabaseMocks.rpc).toHaveBeenCalledWith('delete_transaction', {
      p_expected_updated_at: '2026-08-25T12:00:00Z',
      p_id: persisted.id,
    })
  })

  it('should surface a stale version failure for safe UI mapping', async () => {
    const providerError = { code: '40001', message: 'transaction_conflict' }
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

    await expect(
      deleteTransaction({
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toBe(providerError)
  })

  it('should surface a missing row failure for safe UI mapping', async () => {
    const providerError = { code: 'P0002', message: 'transaction_not_found' }
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: providerError })

    await expect(
      deleteTransaction({
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: '00000000-0000-4000-8000-000000000000',
      }),
    ).rejects.toBe(providerError)
  })
})
