import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
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

function renderPage(month = '2026-08') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  const view = render(
    <QueryClientProvider client={queryClient}>
      <TransactionsPage month={month} userId="user-a" />
    </QueryClientProvider>,
  )

  return { ...view, queryClient }
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
      screen.getByRole('status', { name: 'Carregando lançamentos' }),
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
    const { rerender } = renderPage()

    expect(await screen.findByText('Agosto')).toBeVisible()

    rerender(
      <QueryClientProvider
        client={
          new QueryClient({
            defaultOptions: { queries: { retry: false } },
          })
        }
      >
        <TransactionsPage month="2026-09" userId="user-a" />
      </QueryClientProvider>,
    )

    expect(screen.queryByText('Agosto')).not.toBeInTheDocument()
    expect(
      screen.getByRole('status', { name: 'Carregando lançamentos' }),
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

  it('should replace financial data with the online-required state offline', () => {
    transactionMocks.isOnline = false
    renderPage()

    expect(
      screen.getByRole('heading', {
        name: 'Conecte-se para ver seus lançamentos.',
      }),
    ).toBeVisible()
    expect(transactionMocks.readMonthlyTransactions).not.toHaveBeenCalled()
  })
})
