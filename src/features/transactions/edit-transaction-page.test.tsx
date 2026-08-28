import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UpdateTransactionInput } from './transaction-service'
import type { Transaction } from './transaction-types'

const serviceMocks = vi.hoisted(() => ({
  deleteTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
  isOnline: true,
  readMonthlyTransactions: vi.fn<() => Promise<Transaction[]>>(),
  readTransaction: vi.fn<() => Promise<Transaction | null>>(),
  updateTransaction: vi.fn<(input: unknown) => Promise<Transaction>>(),
}))

vi.mock('./transaction-service', () => ({
  createTransaction: vi.fn<() => void>(),
  deleteTransaction: serviceMocks.deleteTransaction,
  readMonthlyTransactions: serviceMocks.readMonthlyTransactions,
  readTransaction: serviceMocks.readTransaction,
  updateTransaction: serviceMocks.updateTransaction,
}))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => serviceMocks.isOnline,
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

const transactionId = '00000000-0000-4000-8000-000000000001'

function persisted(overrides: Partial<Transaction> = {}): Transaction {
  return {
    amount_cents: 5000,
    created_at: '2026-08-25T12:00:00Z',
    description: 'Mercado',
    id: transactionId,
    kind: 'expense',
    transaction_date: '2026-08-25',
    updated_at: '2026-08-25T12:00:00Z',
    user_id: 'user-a',
    ...overrides,
  }
}

async function renderEditRoute(
  path = `/app/transactions/${transactionId}/edit?month=2026-08`,
) {
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

  return router
}

function typeAmount(digits: string) {
  const input = screen.getByLabelText('Valor') as HTMLInputElement

  fireEvent.change(input, { target: { value: '' } })

  for (const digit of digits) {
    fireEvent.change(input, { target: { value: `${input.value}${digit}` } })
  }
}

function submittedVersions() {
  return serviceMocks.updateTransaction.mock.calls.map(
    ([input]) => (input as UpdateTransactionInput).expectedUpdatedAt,
  )
}

describe('EditTransactionPage', () => {
  beforeEach(() => {
    serviceMocks.isOnline = true
    serviceMocks.readMonthlyTransactions.mockReset()
    serviceMocks.readMonthlyTransactions.mockResolvedValue([])
    serviceMocks.readTransaction.mockReset()
    serviceMocks.updateTransaction.mockReset()
    serviceMocks.deleteTransaction.mockReset()
  })

  it('should open the persisted kind, amount, description, and date', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    await renderEditRoute()

    expect(
      await screen.findByRole('heading', { name: 'Editar lançamento' }),
    ).toBeVisible()
    expect(screen.getByLabelText('Valor')).toHaveValue('50,00')
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue('Mercado')
    expect(screen.getByLabelText('Data')).toHaveValue('2026-08-25')
    expect(screen.getByRole('button', { name: 'Tipo: Saída' })).toBeVisible()
  })

  it('should open a persisted new kind, change it, and submit the new value', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted({ kind: 'daily' }))
    serviceMocks.updateTransaction.mockResolvedValue(
      persisted({ kind: 'savings', updated_at: '2026-08-26T09:00:00Z' }),
    )
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    expect(screen.getByRole('button', { name: 'Tipo: Diário' })).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Diário' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Economia' }))
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() =>
      expect(serviceMocks.updateTransaction).toHaveBeenCalledWith(
        expect.objectContaining({ kind: 'savings' }),
      ),
    )
  })

  it('should offer a safe return when the row is missing or owned by someone else', async () => {
    serviceMocks.readTransaction.mockResolvedValue(null)
    const router = await renderEditRoute()

    expect(
      await screen.findByRole('heading', {
        name: 'Lançamento não encontrado.',
      }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('link', { name: 'Voltar para o mês' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
    expect(router.state.location.search).toEqual({ month: '2026-08' })
  })

  it('should save the new amount against the loaded version and return to the month', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    serviceMocks.updateTransaction.mockResolvedValue(
      persisted({ amount_cents: 7500, updated_at: '2026-08-26T09:00:00Z' }),
    )
    const router = await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    typeAmount('7500')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))

    expect(serviceMocks.updateTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        amountCents: 7500,
        description: 'Mercado',
        expectedUpdatedAt: '2026-08-25T12:00:00Z',
        id: transactionId,
        kind: 'expense',
        transactionDate: '2026-08-25',
      }),
    )
    expect(router.state.location.search).toEqual({ month: '2026-08' })
  })

  it('should follow the row to the month the server persisted it under', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    serviceMocks.updateTransaction.mockResolvedValue(
      persisted({
        transaction_date: '2026-09-02',
        updated_at: '2026-08-26T09:00:00Z',
      }),
    )
    const router = await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    fireEvent.change(screen.getByLabelText('Data'), {
      target: { value: '2026-09-02' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))

    expect(router.state.location.search).toEqual({ month: '2026-09' })
  })

  it('should keep the edited fields and hide provider detail when the save fails', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    serviceMocks.updateTransaction.mockRejectedValue({
      code: '08006',
      message: 'connection failure to db-host-42',
    })
    const router = await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    typeAmount('7500')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível salvar o lançamento. Tente novamente.',
    )
    expect(screen.getByLabelText('Valor')).toHaveValue('75,00')
    expect(screen.queryByText(/db-host-42/)).toBeNull()
    expect(router.state.location.pathname).toBe(
      `/app/transactions/${transactionId}/edit`,
    )
  })

  it('should preserve the newer server row and recover explicitly from a conflict', async () => {
    serviceMocks.readTransaction
      .mockResolvedValueOnce(persisted())
      .mockResolvedValueOnce(
        persisted({
          amount_cents: 9900,
          description: 'Mercado corrigido em outro aparelho',
          updated_at: '2026-08-26T08:00:00Z',
        }),
      )
    serviceMocks.updateTransaction.mockRejectedValue({
      code: 'PT409',
      message: 'transaction_conflict',
    })
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    typeAmount('7500')
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Esse lançamento foi alterado em outro lugar.',
    )
    expect(alert).toHaveTextContent(
      'Recarregar substitui o que você editou pelos dados salvos.',
    )
    expect(screen.getByLabelText('Valor')).toHaveValue('75,00')
    expect(submittedVersions()).toEqual(['2026-08-25T12:00:00Z'])

    fireEvent.click(
      screen.getByRole('button', { name: 'Recarregar lançamento' }),
    )

    await waitFor(() =>
      expect(screen.getByLabelText('Valor')).toHaveValue('99,00'),
    )
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveValue(
      'Mercado corrigido em outro aparelho',
    )
    expect(screen.queryByRole('alert')).toBeNull()

    serviceMocks.updateTransaction.mockResolvedValue(
      persisted({ amount_cents: 9900, updated_at: '2026-08-26T10:00:00Z' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }))

    await waitFor(() => expect(submittedVersions()).toHaveLength(2))
    expect(submittedVersions()[1]).toBe('2026-08-26T08:00:00Z')
  })

  it('should require a connection instead of editing an outdated row', async () => {
    serviceMocks.isOnline = false
    await renderEditRoute()

    expect(
      await screen.findByRole('heading', {
        name: 'Conecte-se para editar este lançamento.',
      }),
    ).toBeVisible()
    expect(serviceMocks.readTransaction).not.toHaveBeenCalled()
  })

  it('should expose a separated destructive delete action', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })

    const save = screen.getByRole('button', { name: 'Salvar' })
    const del = screen.getByRole('button', { name: 'Excluir lançamento' })

    expect(save).toBeVisible()
    expect(del).toBeVisible()
    expect(del.className).toMatch(/coral/)
    // Separated: save lives in the sticky header, delete lives below the form.
    expect(save.closest('header')).not.toBeNull()
    expect(del.closest('header')).toBeNull()
  })

  it('should keep the confirmation hidden until requested and cancel without mutating', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    expect(
      screen.queryByRole('heading', { name: 'Excluir lançamento?' }),
    ).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))

    expect(
      await screen.findByRole('heading', { name: 'Excluir lançamento?' }),
    ).toBeVisible()
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText(/Mercado ·/)).toBeVisible()
    expect(within(dialog).getByText('R$ 50,00')).toBeVisible()
    expect(screen.queryByText(transactionId)).toBeNull()
    expect(screen.queryByText('user-a')).toBeNull()

    fireEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    )

    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Excluir lançamento?' }),
      ).toBeNull(),
    )
    expect(serviceMocks.deleteTransaction).not.toHaveBeenCalled()
    expect(screen.getByLabelText('Valor')).toHaveValue('50,00')
  })

  it('should delete with the loaded version and return to the affected month', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    serviceMocks.deleteTransaction.mockResolvedValue(persisted())
    const router = await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
    expect(serviceMocks.deleteTransaction).toHaveBeenCalledWith({
      expectedUpdatedAt: '2026-08-25T12:00:00Z',
      id: transactionId,
    })
    expect(router.state.location.search).toEqual({ month: '2026-08' })
  })

  it('should disable the delete confirm while the request is pending', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    let resolveDelete!: (value: Transaction) => void
    serviceMocks.deleteTransaction.mockReturnValue(
      new Promise<Transaction>((resolve) => {
        resolveDelete = resolve
      }),
    )
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    expect(
      await screen.findByRole('button', { name: 'Excluindo...' }),
    ).toBeDisabled()
    // Two Cancelar buttons exist while the dialog is open (form header + dialog).
    // The dialog's Cancelar is the one that must be disabled while pending.
    expect(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancelar',
      }),
    ).toBeDisabled()

    resolveDelete(persisted())
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { name: 'Excluir lançamento?' }),
      ).toBeNull(),
    )
  })

  it('should keep the confirmation recoverable when the delete fails', async () => {
    serviceMocks.readTransaction.mockResolvedValue(persisted())
    serviceMocks.deleteTransaction.mockRejectedValue({
      code: '08006',
      message: 'connection failure to db-host-42',
    })
    const router = await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Não foi possível salvar o lançamento. Tente novamente.',
    )
    expect(screen.queryByText(/db-host-42/)).toBeNull()
    expect(
      screen.getByRole('heading', { name: 'Excluir lançamento?' }),
    ).toBeVisible()
    expect(router.state.location.pathname).toBe(
      `/app/transactions/${transactionId}/edit`,
    )
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeEnabled()

    // Retry succeeds.
    serviceMocks.deleteTransaction.mockResolvedValue(persisted())
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/app'))
  })

  it('should preserve the newer server row and recover explicitly from a delete conflict', async () => {
    serviceMocks.readTransaction
      .mockResolvedValueOnce(persisted())
      .mockResolvedValueOnce(
        persisted({
          amount_cents: 9900,
          description: 'Mercado corrigido em outro aparelho',
          updated_at: '2026-08-26T08:00:00Z',
        }),
      )
    serviceMocks.deleteTransaction.mockRejectedValue({
      code: 'PT409',
      message: 'transaction_conflict',
    })
    await renderEditRoute()

    await screen.findByRole('heading', { name: 'Editar lançamento' })
    fireEvent.click(screen.getByRole('button', { name: 'Excluir lançamento' }))
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent(
      'Esse lançamento foi alterado em outro lugar.',
    )
    expect(alert).toHaveTextContent(
      'Recarregar substitui o que você editou pelos dados salvos.',
    )
    expect(screen.getByRole('button', { name: 'Excluir' })).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Recarregar lançamento' }),
    )

    const dialog = screen.getByRole('dialog')
    await waitFor(() => {
      expect(
        within(dialog).getByText(/Mercado corrigido em outro aparelho ·/),
      ).toBeVisible()
      expect(within(dialog).getByText('R$ 99,00')).toBeVisible()
    })
    expect(screen.queryByRole('alert')).toBeNull()

    serviceMocks.deleteTransaction.mockResolvedValue(
      persisted({ amount_cents: 9900, updated_at: '2026-08-26T10:00:00Z' }),
    )
    fireEvent.click(screen.getByRole('button', { name: 'Excluir' }))

    await waitFor(() =>
      expect(serviceMocks.deleteTransaction).toHaveBeenCalledTimes(2),
    )
    expect(serviceMocks.deleteTransaction.mock.calls[1][0]).toEqual(
      expect.objectContaining({ expectedUpdatedAt: '2026-08-26T08:00:00Z' }),
    )
  })
})
