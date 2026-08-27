import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { DeleteTransactionDialog } from './delete-transaction-dialog'
import type { Transaction } from './transaction-types'

function transaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    amount_cents: 5000,
    created_at: '2026-08-25T12:00:00Z',
    description: 'Mercado',
    id: '00000000-0000-4000-8000-000000000001',
    kind: 'expense',
    transaction_date: '2026-08-25',
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
    ...overrides,
  }
}

type DialogOverrides = Partial<
  React.ComponentProps<typeof DeleteTransactionDialog>
>

function renderDialog(overrides: DialogOverrides = {}) {
  const onCancel = vi.fn<() => void>()
  const onConfirm = vi.fn<() => void>()
  const onConflictReload = vi.fn<() => void>()

  render(
    <DeleteTransactionDialog
      errorCopy={null}
      hasConflict={false}
      isOnline={true}
      isPending={false}
      onCancel={onCancel}
      onConfirm={onConfirm}
      onConflictReload={onConflictReload}
      open={true}
      transaction={transaction()}
      {...overrides}
    />,
  )

  return { onCancel, onConfirm, onConflictReload }
}

describe('DeleteTransactionDialog', () => {
  it('should name the transaction without exposing hidden backend fields', () => {
    renderDialog({ transaction: transaction({ description: 'Mercado' }) })

    expect(
      screen.getByRole('heading', { name: 'Excluir lançamento?' }),
    ).toBeVisible()
    expect(screen.getByText('Mercado · R$ 50,00')).toBeVisible()
    expect(screen.getByText('Essa ação não pode ser desfeita.')).toBeVisible()
    expect(screen.queryByText(/00000000-0000/)).toBeNull()
    expect(screen.queryByText(/user-a/)).toBeNull()
    expect(screen.queryByText(/2026-08-25T12/)).toBeNull()
  })

  it('should fall back to a kind label when the description is missing', () => {
    renderDialog({
      transaction: transaction({ description: null, kind: 'income' }),
    })

    expect(screen.getByText('Entrada sem descrição · R$ 50,00')).toBeVisible()
  })

  it('should call onCancel and not onConfirm when cancel is clicked', () => {
    const { onCancel, onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('should call onConfirm when the destructive action is confirmed', () => {
    const { onConfirm } = renderDialog()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(onConfirm).toHaveBeenCalledTimes(1)
  })

  it('should disable confirm while the request is pending and show pending copy', () => {
    renderDialog({ isPending: true })

    expect(screen.getByRole('button', { name: 'Excluindo...' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeDisabled()
    expect(screen.getByText('Excluindo e atualizando o mês...')).toBeVisible()
  })

  it('should disable confirm while offline and explain why', () => {
    renderDialog({ isOnline: false })

    expect(screen.getByRole('button', { name: 'Excluir' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeEnabled()
    expect(
      screen.getByText('Sem conexão. Conecte-se para excluir.'),
    ).toBeVisible()
  })

  it('should show a conflict error with an explicit reload action', () => {
    const { onConflictReload } = renderDialog({
      errorCopy:
        'Esse lançamento foi alterado em outro lugar. Recarregar substitui o que você editou pelos dados salvos.',
      hasConflict: true,
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Esse lançamento foi alterado em outro lugar.',
    )
    expect(alert).toHaveTextContent(
      'Recarregar substitui o que você editou pelos dados salvos.',
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'Recarregar lançamento' }),
    )

    expect(onConflictReload).toHaveBeenCalledTimes(1)
  })

  it('should show a generic failure without a reload action', () => {
    renderDialog({
      errorCopy: 'Não foi possível salvar o lançamento. Tente novamente.',
      hasConflict: false,
    })

    const alert = screen.getByRole('alert')
    expect(alert).toHaveTextContent(
      'Não foi possível salvar o lançamento. Tente novamente.',
    )
    expect(
      screen.queryByRole('button', { name: 'Recarregar lançamento' }),
    ).toBeNull()
  })

  it('should keep the dialog hidden when not open', () => {
    renderDialog({ open: false })

    expect(
      screen.queryByRole('heading', { name: 'Excluir lançamento?' }),
    ).toBeNull()
  })
})
