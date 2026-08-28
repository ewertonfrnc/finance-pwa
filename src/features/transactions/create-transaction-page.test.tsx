import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { CreateTransactionInput } from './transaction-service'
import type { Transaction } from './transaction-types'

const serviceMocks = vi.hoisted(() => ({
  createTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
  readMonthlyTransactions: vi.fn<() => Promise<Transaction[]>>(),
}))

vi.mock('./transaction-service', () => ({
  createTransaction: serviceMocks.createTransaction,
  readMonthlyTransactions: serviceMocks.readMonthlyTransactions,
}))

vi.mock('../auth/auth-service', () => ({
  signInWithEmail: vi.fn<() => void>(),
  registerWithEmail: vi.fn<() => void>(),
  requestPasswordRecovery: vi.fn<() => void>(),
  signOutGlobally: vi.fn<() => void>(),
  signOutLocally: vi.fn<() => void>(),
  updatePassword: vi.fn<() => void>(),
}))

import { UnsavedChangesProvider } from '../../app/unsaved-changes'
import type { RouterContext } from '../../app/router-context'
import { routeTree } from '../../routeTree.gen'
import {
  getDefaultTransactionDate,
  getLocalCurrentMonth,
} from './transaction-calendar'

const currentMonth = getLocalCurrentMonth()
const today = getDefaultTransactionDate(currentMonth)

function persistedTransaction(overrides: Partial<Transaction> = {}) {
  return {
    amount_cents: 5000,
    created_at: `${today}T12:00:00Z`,
    description: null,
    id: 'persisted-id',
    kind: 'expense',
    transaction_date: today,
    updated_at: `${today}T12:00:00Z`,
    user_id: 'user-a',
    ...overrides,
  } as Transaction
}

async function renderCreateRoute(path: string) {
  const context: RouterContext = {
    auth: {
      isPasswordRecovery: false,
      session: { user: { id: 'user-a' } } as Session,
      status: 'authenticated',
    },
    queryClient: new QueryClient({
      defaultOptions: { queries: { retry: false } },
    }),
  }
  const router = createRouter({
    context,
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree,
  })

  render(
    <QueryClientProvider client={context.queryClient}>
      <UnsavedChangesProvider>
        <RouterProvider context={context} router={router} />
      </UnsavedChangesProvider>
    </QueryClientProvider>,
  )

  await screen.findByRole('heading', { name: 'Novo lançamento' })

  return router
}

function typeAmount(digits: string) {
  const input = screen.getByLabelText('Valor') as HTMLInputElement

  for (const digit of digits) {
    fireEvent.change(input, { target: { value: `${input.value}${digit}` } })
  }
}

function submittedIds() {
  return serviceMocks.createTransaction.mock.calls.map(
    ([input]) => (input as CreateTransactionInput).id,
  )
}

describe('CreateTransactionPage', () => {
  beforeEach(() => {
    serviceMocks.createTransaction.mockReset()
    serviceMocks.readMonthlyTransactions.mockReset()
    serviceMocks.readMonthlyTransactions.mockResolvedValue([])
  })

  it('should open the current month on today', async () => {
    await renderCreateRoute(`/app/transactions/new?month=${currentMonth}`)

    expect(screen.getByLabelText('Data')).toHaveValue(today)
    expect(screen.getByText(/^Hoje · /)).toBeVisible()
  })

  it('should clamp the day when the selected month is not the current one', async () => {
    await renderCreateRoute('/app/transactions/new?month=2026-02')

    const day = Math.min(Number(today.slice(8, 10)), 28)

    expect(screen.getByLabelText('Data')).toHaveValue(
      `2026-02-${String(day).padStart(2, '0')}`,
    )
  })

  it('should send exact centavos and return to the persisted month', async () => {
    serviceMocks.createTransaction.mockResolvedValue(persistedTransaction())
    const router = await renderCreateRoute(
      `/app/transactions/new?month=${currentMonth}`,
    )

    typeAmount('5000')
    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), {
      target: { value: '  Mercado  ' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))

    expect(serviceMocks.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 5000,
        description: 'Mercado',
        kind: 'expense',
        transactionDate: today,
      }),
      expect.anything(),
    )
    expect(router.state.location.search).toEqual({ month: currentMonth })
  })

  it('should send a newly widened kind selected in the picker', async () => {
    serviceMocks.createTransaction.mockResolvedValue(
      persistedTransaction({ kind: 'daily' }),
    )
    const router = await renderCreateRoute(
      `/app/transactions/new?month=${currentMonth}`,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Saída' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Diário' }))
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))

    expect(serviceMocks.createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 5000,
        kind: 'daily',
      }),
      expect.anything(),
    )
  })

  it('should keep the draft and translate a provider failure', async () => {
    serviceMocks.createTransaction.mockRejectedValue({
      code: '23505',
      message: 'transaction_id_conflict',
    })
    await renderCreateRoute(`/app/transactions/new?month=${currentMonth}`)

    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Esse lançamento já foi enviado com dados diferentes.',
    )
    expect(screen.getByLabelText('Valor')).toHaveValue('50,00')
    expect(screen.queryByText(/transaction_id_conflict/)).toBeNull()
  })

  it('should reuse the submission id on an unchanged retry and mint one after an edit', async () => {
    serviceMocks.createTransaction.mockRejectedValue(new Error('offline'))
    await renderCreateRoute(`/app/transactions/new?month=${currentMonth}`)

    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() => expect(submittedIds()).toHaveLength(1))

    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() => expect(submittedIds()).toHaveLength(2))

    typeAmount('0')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() => expect(submittedIds()).toHaveLength(3))

    const [first, retry, afterEdit] = submittedIds()

    expect(retry).toBe(first)
    expect(afterEdit).not.toBe(first)
  })

  it('should reuse the original id when an edit is reverted before retrying', async () => {
    serviceMocks.createTransaction.mockRejectedValue(new Error('offline'))
    await renderCreateRoute(`/app/transactions/new?month=${currentMonth}`)

    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() => expect(submittedIds()).toHaveLength(1))

    const description = screen.getByLabelText('Descrição (opcional)')
    fireEvent.change(description, { target: { value: 'Mercado' } })
    fireEvent.change(description, { target: { value: '' } })
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))
    await waitFor(() => expect(submittedIds()).toHaveLength(2))

    expect(submittedIds()[1]).toBe(submittedIds()[0])
  })
})
