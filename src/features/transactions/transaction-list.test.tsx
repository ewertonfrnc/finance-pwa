import { render, screen, within } from '@testing-library/react'
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

describe('TransactionList', () => {
  it('should group rows by date and identify income and expense in text', () => {
    render(<TransactionList transactions={transactions} />)

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
})
