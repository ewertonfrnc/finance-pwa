import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const networkMocks = vi.hoisted(() => ({ isOnline: true }))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => networkMocks.isOnline,
}))

import { UnsavedChangesProvider } from '../../app/unsaved-changes'
import {
  getDefaultTransactionDate,
  getLocalCurrentMonth,
} from './transaction-calendar'
import { TransactionForm } from './transaction-form'
import type { TransactionPayload } from './transaction-form-schema'

const today = getDefaultTransactionDate(getLocalCurrentMonth())

type FormOverrides = {
  errorAction?: { label: string; onAction: () => void }
  errorCopy?: string | null
  isPending?: boolean
  onSubmit?: (payload: TransactionPayload) => void
}

async function renderForm({
  errorAction,
  errorCopy = null,
  isPending = false,
  onSubmit = () => {},
}: FormOverrides) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const formRoute = createRoute({
    component: () => (
      <FormHarness
        errorAction={errorAction}
        errorCopy={errorCopy}
        isPending={isPending}
        onSubmit={onSubmit}
      />
    ),
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const historyRoute = createRoute({
    component: () => <h1>Lançamentos</h1>,
    getParentRoute: () => rootRoute,
    path: '/app',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([formRoute, historyRoute]),
  })

  render(
    <UnsavedChangesProvider>
      <RouterProvider router={router as never} />
    </UnsavedChangesProvider>,
  )

  // The router resolves its first match asynchronously, so nothing is in the
  // document until the form route renders.
  await screen.findByRole('button', { name: 'Cancelar' })
}

// Mirrors real keystrokes: the browser appends the character to the formatted
// value before the change handler reduces it back to digits.
function typeAmount(digits: string) {
  const input = screen.getByLabelText('Valor') as HTMLInputElement

  for (const digit of digits) {
    fireEvent.change(input, { target: { value: `${input.value}${digit}` } })
  }
}

function FormHarness({
  errorAction,
  errorCopy,
  isPending,
  onSubmit,
}: FormOverrides & Required<Pick<FormOverrides, 'isPending' | 'onSubmit'>>) {
  const navigate = useNavigate()

  return (
    <TransactionForm
      confirmLabel="Lançar"
      errorAction={errorAction}
      errorCopy={errorCopy ?? null}
      initialValues={{
        amountDigits: '',
        date: today,
        description: '',
        kind: 'expense',
      }}
      isPending={isPending}
      isSaved={false}
      onCancel={() => void navigate({ to: '/app' })}
      onSubmit={onSubmit}
      pendingLabel="Lançando..."
      title="Novo lançamento"
    />
  )
}

describe('TransactionForm', () => {
  beforeEach(() => {
    networkMocks.isOnline = true
  })

  it('should show zero as a placeholder and submit the typed digits as centavos', async () => {
    const onSubmit = vi.fn<(payload: TransactionPayload) => void>()
    await renderForm({ onSubmit })
    const amount = screen.getByLabelText('Valor')

    expect(screen.getByText('R$', { exact: true })).toBeVisible()
    expect(amount).toHaveValue('')
    expect(amount).toHaveAttribute('placeholder', '0,00')

    typeAmount('5000')

    expect(amount).toHaveValue('50,00')

    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(onSubmit).toHaveBeenCalledWith({
      amount_cents: 5000,
      description: null,
      kind: 'expense',
      transaction_date: today,
    })
  })

  it('should echo the selected date with its distance from today', async () => {
    await renderForm({})

    expect(screen.getByText(/^Hoje · /)).toBeVisible()
  })

  it('should explain what the selected kind does to the balance', async () => {
    await renderForm({})

    const picker = screen.getByRole('button', { name: 'Tipo: Saída' })

    expect(picker).toHaveAttribute('aria-expanded', 'false')
    expect(
      screen.getByText('Reduz o saldo do dia como gasto pontual.'),
    ).toBeVisible()
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveAttribute(
      'placeholder',
      'Onde foi parar essa grana?',
    )

    fireEvent.click(picker)

    expect(picker).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('radio', { name: 'Entrada' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Saída' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Diário' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'Economia' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('radio', { name: 'Entrada' }))

    const updatedTrigger = screen.getByRole('button', {
      name: 'Tipo: Entrada',
    })

    expect(updatedTrigger).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByText('Aumenta o saldo do dia.')).toBeVisible()
    expect(screen.getByLabelText('Descrição (opcional)')).toHaveAttribute(
      'placeholder',
      'De onde veio essa grana?',
    )
    // Selecting a radio closes the picker and returns focus to its trigger.
    expect(updatedTrigger).toHaveFocus()
  })

  it('should show the daily and savings copy and submit a new-kind payload', async () => {
    const onSubmit = vi.fn<(payload: TransactionPayload) => void>()
    await renderForm({ onSubmit })

    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Saída' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Diário' }))

    expect(screen.getByText('Conta como gasto diário da rotina.')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Tipo: Diário' }))
    fireEvent.click(screen.getByRole('radio', { name: 'Economia' }))

    expect(
      screen.getByText('Reserva valor e também reduz o saldo disponível.'),
    ).toBeVisible()

    typeAmount('1500')
    fireEvent.click(screen.getByRole('button', { name: 'Lançar' }))

    expect(onSubmit).toHaveBeenCalledWith({
      amount_cents: 1500,
      description: null,
      kind: 'savings',
      transaction_date: today,
    })
  })

  it('should keep the confirm action available and report the invalid field on submit', async () => {
    const onSubmit = vi.fn<(payload: TransactionPayload) => void>()
    await renderForm({ onSubmit })
    const confirm = screen.getByRole('button', { name: 'Lançar' })

    expect(confirm).toBeEnabled()

    fireEvent.click(confirm)

    expect(onSubmit).not.toHaveBeenCalled()
    expect(
      screen.getByText('Informe um valor maior que R$ 0,00.'),
    ).toBeVisible()
    expect(screen.getByLabelText('Valor')).toHaveFocus()
  })

  it('should count the description against the persisted limit', async () => {
    await renderForm({})

    expect(screen.queryByText('0/120')).not.toBeInTheDocument()

    fireEvent.change(screen.getByLabelText('Descrição (opcional)'), {
      target: { value: 'Mercado' },
    })

    expect(screen.getByText('7/120')).toBeVisible()
  })

  it('should keep the draft editable but refuse to submit while offline', async () => {
    networkMocks.isOnline = false
    const onSubmit = vi.fn<(payload: TransactionPayload) => void>()
    await renderForm({ onSubmit })

    typeAmount('5000')

    expect(screen.getByLabelText('Valor')).toHaveValue('50,00')
    expect(screen.getByRole('button', { name: 'Lançar' })).toBeDisabled()
    expect(
      screen.getByText(
        'Sem conexão. O rascunho continua aqui; conecte-se para lançar.',
      ),
    ).toBeVisible()
  })

  it('should refuse duplicate interaction while the mutation is pending', async () => {
    await renderForm({ isPending: true })

    expect(screen.getByRole('button', { name: 'Lançando...' })).toBeDisabled()
  })

  it('should offer the recovery action next to the failure it belongs to', async () => {
    const onAction = vi.fn<() => void>()
    await renderForm({
      errorAction: { label: 'Recarregar lançamento', onAction },
      errorCopy: 'Esse lançamento foi alterado em outro lugar.',
    })

    const alert = screen.getByRole('alert')

    expect(alert).toHaveTextContent(
      'Esse lançamento foi alterado em outro lugar.',
    )

    fireEvent.click(
      within(alert).getByRole('button', { name: 'Recarregar lançamento' }),
    )

    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('should confirm before discarding a dirty draft', async () => {
    await renderForm({})

    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(
      await screen.findByRole('heading', {
        name: 'Descartar este lançamento?',
      }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))

    expect(screen.getByLabelText('Valor')).toHaveValue('50,00')

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible(),
    )
  })

  it('should leave a clean draft without a discard confirmation', async () => {
    await renderForm({})

    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { name: 'Lançamentos' }),
      ).toBeVisible(),
    )
  })
})
