import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Link,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Transaction } from './transaction-types'

const transactionMocks = vi.hoisted(() => ({
  isOnline: true,
  readMonthlyTransactions:
    vi.fn<
      (input: { month: string; signal: AbortSignal }) => Promise<Transaction[]>
    >(),
}))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => transactionMocks.isOnline,
}))

vi.mock('./transaction-service', () => ({
  readMonthlyTransactions: transactionMocks.readMonthlyTransactions,
}))

import { TransactionsPage } from './transactions-page'

function transaction(description: string, month = '2026-08'): Transaction {
  return {
    amount_cents: 5000,
    created_at: `${month}-25T12:00:00Z`,
    description,
    id: `${description}-id`,
    kind: 'expense',
    transaction_date: `${month}-25`,
    updated_at: `${month}-25T12:00:00Z`,
    user_id: 'user-a',
  }
}

// The list rows link to the edit route, so the history needs a router even in
// a focused test. The month lives in the URL exactly as it does in the app.
function renderPage(month = '2026-08') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const historyRoute = createRoute({
    component: HistoryHarness,
    getParentRoute: () => rootRoute,
    path: '/app',
    validateSearch: (search: Record<string, unknown>) => ({
      month: typeof search.month === 'string' ? search.month : month,
    }),
  })
  const editRoute = createRoute({
    component: () => <h1>Editar lançamento</h1>,
    getParentRoute: () => rootRoute,
    path: '/app/transactions/$transactionId/edit',
  })

  function HistoryHarness() {
    // The ad-hoc test tree is not the registered router, so its search type
    // does not resolve on its own.
    const search = historyRoute.useSearch() as { month: string }

    return (
      <>
        <Link search={{ month: '2026-09' }} to="/app">
          Ir para setembro
        </Link>
        <TransactionsPage month={search.month} userId="user-a" />
      </>
    )
  }

  const router = createRouter({
    history: createMemoryHistory({ initialEntries: [`/app?month=${month}`] }),
    routeTree: rootRoute.addChildren([historyRoute, editRoute]),
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )

  return { ...view, queryClient, router }
}

describe('TransactionsPage', () => {
  beforeEach(() => {
    transactionMocks.isOnline = true
    transactionMocks.readMonthlyTransactions.mockReset()
  })

  it('should render the current user monthly transactions', async () => {
    transactionMocks.readMonthlyTransactions.mockResolvedValue([
      transaction('Mercado'),
    ])
    renderPage()

    expect(
      await screen.findByRole('status', { name: 'Carregando lançamentos' }),
    ).toBeVisible()
    expect(await screen.findByText('Mercado')).toBeVisible()
    expect(transactionMocks.readMonthlyTransactions).toHaveBeenCalledWith({
      month: '2026-08',
      signal: expect.any(AbortSignal),
    })
  })

  it('should replace the prior month with loading while the next month loads', async () => {
    let resolveSeptember: ((value: Transaction[]) => void) | undefined
    transactionMocks.readMonthlyTransactions.mockImplementation(({ month }) => {
      if (month === '2026-08') {
        return Promise.resolve([transaction('Agosto')])
      }

      return new Promise((resolve) => {
        resolveSeptember = resolve
      })
    })
    renderPage()

    expect(await screen.findByText('Agosto')).toBeVisible()

    fireEvent.click(screen.getByRole('link', { name: 'Ir para setembro' }))

    await waitFor(() =>
      expect(screen.queryByText('Agosto')).not.toBeInTheDocument(),
    )
    expect(
      await screen.findByRole('status', { name: 'Carregando lançamentos' }),
    ).toBeVisible()

    resolveSeptember?.([transaction('Setembro', '2026-09')])
    expect(await screen.findByText('Setembro')).toBeVisible()
  })

  it('should show an intentional empty month state', async () => {
    transactionMocks.readMonthlyTransactions.mockResolvedValue([])
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: 'Nenhum lançamento neste mês.',
      }),
    ).toBeVisible()
    expect(
      screen.getByText(
        'Use Adicionar para registrar a primeira entrada ou saída.',
      ),
    ).toBeVisible()
  })

  it('should hide provider details and retry a failed read', async () => {
    transactionMocks.readMonthlyTransactions
      .mockRejectedValueOnce(new Error('Provider detail must stay hidden'))
      .mockResolvedValueOnce([])
    renderPage()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Não foi possível carregar o mês.')
    expect(alert).not.toHaveTextContent('Provider detail')

    screen.getByRole('button', { name: 'Tentar novamente' }).click()

    await waitFor(() =>
      expect(transactionMocks.readMonthlyTransactions).toHaveBeenCalledTimes(2),
    )
    expect(
      await screen.findByRole('heading', {
        name: 'Nenhum lançamento neste mês.',
      }),
    ).toBeVisible()
  })

  it('should replace financial data with the online-required state offline', async () => {
    transactionMocks.isOnline = false
    renderPage()

    expect(
      await screen.findByRole('heading', {
        name: 'Conecte-se para ver seus lançamentos.',
      }),
    ).toBeVisible()
    expect(transactionMocks.readMonthlyTransactions).not.toHaveBeenCalled()
  })
})
