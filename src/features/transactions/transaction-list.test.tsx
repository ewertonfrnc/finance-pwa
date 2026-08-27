import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Transaction } from './transaction-types'
import { TransactionList } from './transaction-list'

const transactions: Transaction[] = [
  {
    amount_cents: 500000,
    created_at: '2026-08-25T12:00:00Z',
    description: 'Salário',
    id: 'income-a',
    kind: 'income',
    transaction_date: '2026-08-25',
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
  },
  {
    amount_cents: 12550,
    created_at: '2026-08-24T12:00:00Z',
    description: null,
    id: 'expense-a',
    kind: 'expense',
    transaction_date: '2026-08-24',
    updated_at: '2026-08-24T12:00:00Z',
    user_id: 'user-a',
  },
]

async function renderList() {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const historyRoute = createRoute({
    component: () => (
      <TransactionList month="2026-08" transactions={transactions} />
    ),
    getParentRoute: () => rootRoute,
    path: '/app',
  })
  const editRoute = createRoute({
    component: () => <h1>Editar lançamento</h1>,
    getParentRoute: () => rootRoute,
    path: '/app/transactions/$transactionId/edit',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/app'] }),
    routeTree: rootRoute.addChildren([historyRoute, editRoute]),
  })

  render(<RouterProvider router={router as never} />)
  await screen.findByRole('list', { name: 'Lançamentos do mês' })

  return router
}

describe('TransactionList', () => {
  it('should group rows by date and identify income and expense in text', async () => {
    await renderList()

    const list = screen.getByRole('list', { name: 'Lançamentos do mês' })
    expect(within(list).getByText('Terça-feira, 25 de agosto')).toBeVisible()
    expect(within(list).getByText('Segunda-feira, 24 de agosto')).toBeVisible()
    expect(within(list).getByText('Salário')).toBeVisible()
    expect(within(list).getByText('Entrada')).toBeVisible()
    expect(within(list).getByText('R$ 5.000,00')).toBeVisible()
    expect(within(list).getByText('Saída sem descrição')).toBeVisible()
    expect(within(list).getByText('Saída')).toBeVisible()
    expect(within(list).getByText('R$ 125,50')).toBeVisible()
  })

  it('should open the edit screen of the selected row keeping the browsed month', async () => {
    const router = await renderList()

    fireEvent.click(screen.getByRole('link', { name: /Salário/ }))

    await screen.findByRole('heading', { name: 'Editar lançamento' })

    expect(router.state.location.pathname).toBe(
      '/app/transactions/income-a/edit',
    )
    expect(router.state.location.search).toEqual({ month: '2026-08' })
  })
})
