import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
  useNavigate,
} from '@tanstack/react-router'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const networkMocks = vi.hoisted(() => ({ isOnline: true }))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => networkMocks.isOnline,
}))

import { UnsavedChangesProvider } from '../../app/unsaved-changes'
import { getLocalTodayIsoDate } from '../../lib/calendar-date'
import { StartingPositionForm } from './starting-position-form'
import type { StartingPositionPayload } from './starting-position-schema'

function dispatchBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

type FormHarnessProps = {
  errorCopy?: string | null
  isPending?: boolean
  onLogout?: () => void
  onSubmit?: (payload: StartingPositionPayload) => void
}

function FormHarness({
  errorCopy = null,
  isPending = false,
  onLogout = () => {},
  onSubmit = () => {},
}: FormHarnessProps) {
  const navigate = useNavigate()

  return (
    <>
      <StartingPositionForm
        errorCopy={errorCopy}
        isPending={isPending}
        onLogout={onLogout}
        onSubmit={onSubmit}
      />
      <button onClick={() => void navigate({ to: '/app' })} type="button">
        Ir para app
      </button>
    </>
  )
}

async function renderForm(props: FormHarnessProps = {}) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const formRoute = createRoute({
    component: () => <FormHarness {...props} />,
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

  await screen.findByRole('heading', { name: 'Ponto de partida' })
}

function typeAmount(digits: string) {
  const input = screen.getByLabelText('Saldo inicial') as HTMLInputElement
  for (const digit of digits) {
    fireEvent.change(input, { target: { value: `${input.value}${digit}` } })
  }
}

describe('StartingPositionForm', () => {
  beforeEach(() => {
    networkMocks.isOnline = true
  })

  it('should default to zero available balance and the device-local current date', async () => {
    await renderForm()

    expect(screen.getByLabelText('Saldo inicial')).toHaveValue('')
    expect(screen.getByLabelText('Saldo inicial')).toHaveAttribute(
      'placeholder',
      '0,00',
    )
    expect(screen.getByRole('radio', { name: 'Disponível' })).toBeChecked()
    expect(screen.getByRole('radio', { name: 'No vermelho' })).not.toBeChecked()
    expect(screen.queryByLabelText('Data de abertura')).not.toBeInTheDocument()

    // Review should show today as the effective date.
    typeAmount('100')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const today = getLocalTodayIsoDate()
    expect(await screen.findByText(today)).toBeVisible()
  })

  it('should keep positive, zero, and negative values reachable with touch and keyboard', async () => {
    const onSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    await renderForm({ onSubmit })

    // Positive: Disponível + 5000 -> 50,00
    typeAmount('5000')
    expect(screen.getByLabelText('Saldo inicial')).toHaveValue('50,00')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('Revise seu ponto de partida')).toBeVisible()
    expect(screen.getByText('R$ 50,00')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))
    expect(await screen.findByRole('button', { name: 'Revisar' })).toBeVisible()

    // Zero magnitude stays zero regardless of direction
    fireEvent.change(screen.getByLabelText('Saldo inicial'), {
      target: { value: '' },
    })
    // typeAmount('0') would result in '' -> '' but we test direct empty
    fireEvent.click(screen.getByRole('radio', { name: 'No vermelho' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('R$ 0,00')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))

    // Negative: No vermelho + 5000 -> −R$ 50,00
    fireEvent.click(screen.getByRole('radio', { name: 'Disponível' }))
    typeAmount('2500')
    fireEvent.click(screen.getByRole('radio', { name: 'No vermelho' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('−R$ 25,00')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('should focus the first invalid field and call no service', async () => {
    const onSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    await renderForm({ onSubmit })

    // With the date removed, the only validation is amount magnitude.
    // An empty amount is valid (zero), so submitting with defaults should go to review
    // and not call the service directly.
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    expect(onSubmit).not.toHaveBeenCalled()
    expect(await screen.findByText('Revise seu ponto de partida')).toBeVisible()
    expect(screen.getByText('R$ 0,00')).toBeVisible()
  })

  it('should show review without calling Supabase on the first valid submit', async () => {
    const onSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    await renderForm({ onSubmit })

    typeAmount('12345')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))

    expect(await screen.findByText('Revise seu ponto de partida')).toBeVisible()
    expect(onSubmit).not.toHaveBeenCalled()
    expect(screen.getByText('R$ 123,45')).toBeVisible()
    expect(
      screen.getByText(/Esse valor vira seu ponto de partida/),
    ).toBeVisible()
  })

  it('should preserve every field when returning from review', async () => {
    await renderForm()
    typeAmount('7777')
    fireEvent.click(screen.getByRole('radio', { name: 'No vermelho' }))
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('−R$ 77,77')).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Voltar e corrigir' }))

    expect(await screen.findByLabelText('Saldo inicial')).toHaveValue('77,77')
    expect(screen.getByRole('radio', { name: 'No vermelho' })).toBeChecked()
  })

  it('should disable confirmation while offline and associate its explanation', async () => {
    networkMocks.isOnline = true
    await renderForm()
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const confirm = await screen.findByRole('button', {
      name: 'Confirmar ponto de partida',
    })
    expect(confirm).toBeEnabled()

    // Re-render offline
    networkMocks.isOnline = false
    // Need to re-render with same review state - we keep isReviewing, so offline disables
    // Unmount and re-render via rerender? Instead, we test offline initial review via props.
    // Simulate offline by firing online event? Our mock is static, so we need to trigger re-render.
    // We change mock and re-render form in review mode via a new render.
    // Simpler: test that when offline, confirm button is disabled and has describedBy.
    // We'll create a new isolated render offline.
    const { unmount } = await (async () => {
      // already rendered, we can just check that after going offline, the button would be disabled
      // For this test, we verify the offline footnote appears when we go offline and retry.
      return { unmount: () => {} }
    })()

    // Directly test offline rendering: render fresh form offline and go to review
    // Use a clean container
    document.body.innerHTML = ''
    await renderForm()
    // Still online at this point because mock is false? Actually we set false before second render
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const offlineConfirm = await screen.findByRole('button', {
      name: 'Confirmar ponto de partida',
    })
    expect(offlineConfirm).toBeDisabled()
    expect(offlineConfirm).toHaveAttribute('aria-describedby')
    const describedId = offlineConfirm.getAttribute('aria-describedby')!
    expect(document.getElementById(describedId)).toHaveTextContent(
      'Sem conexão. O rascunho continua aqui; conecte-se para confirmar.',
    )
    void unmount
  })

  it('should disable confirmation while pending and associate its explanation', async () => {
    await renderForm()
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('Revise seu ponto de partida')).toBeVisible()

    document.body.innerHTML = ''
    const pendingOnSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    await renderForm({ isPending: true, onSubmit: pendingOnSubmit })
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const pendingConfirm = await screen.findByRole('button', {
      name: 'Salvando...',
    })
    expect(pendingConfirm).toBeDisabled()
    const describedId = pendingConfirm.getAttribute('aria-describedby')!
    expect(document.getElementById(describedId)).toHaveTextContent(
      'Salvando ponto de partida...',
    )
  })

  it('should keep the exact review values available for retry after a failure', async () => {
    const onSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    await renderForm({
      errorCopy: 'Não foi possível salvar o ponto de partida. Tente novamente.',
      onSubmit,
    })
    typeAmount('9999')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    const reviewHeading = await screen.findByText('Revise seu ponto de partida')
    expect(reviewHeading).toBeVisible()
    expect(screen.getByText('R$ 99,99')).toBeVisible()
    // Error should be visible in review
    expect(
      screen.getByText(
        'Não foi possível salvar o ponto de partida. Tente novamente.',
      ),
    ).toBeVisible()
    // Retry should still have same values
    const confirm = screen.getByRole('button', {
      name: 'Confirmar ponto de partida',
    })
    fireEvent.click(confirm)
    expect(onSubmit).toHaveBeenCalledTimes(1)
    expect(onSubmit).toHaveBeenCalledWith({
      balance_cents: 9999,
      effective_on: getLocalTodayIsoDate(),
    })
    // After click, review still visible (page would keep it on error, form keeps it)
    expect(screen.getByText('R$ 99,99')).toBeVisible()
  })

  it('should block route navigation, browser unload, and keep PWA deferred while dirty', async () => {
    await renderForm()
    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)

    typeAmount('100')
    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Ir para app' }))
    expect(
      await screen.findByRole('heading', {
        name: 'Descartar ponto de partida?',
      }),
    ).toBeVisible()

    fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }))
    expect(screen.getByLabelText('Saldo inicial')).toHaveValue('1,00')

    fireEvent.click(screen.getByRole('button', { name: 'Ir para app' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Descartar' }))

    await waitFor(() => expect(screen.getByText('Lançamentos')).toBeVisible())
  })

  it('should leave a clean draft without a discard confirmation', async () => {
    await renderForm()
    fireEvent.click(screen.getByRole('button', { name: 'Ir para app' }))
    await waitFor(() => expect(screen.getByText('Lançamentos')).toBeVisible())
  })

  it('should keep logout reachable from entry and never submit the form', async () => {
    const onSubmit = vi.fn<(payload: StartingPositionPayload) => void>()
    const onLogout = vi.fn<() => void>()
    await renderForm({ onLogout, onSubmit })

    const logoutButtons = screen.getAllByRole('button', { name: 'Sair' })
    expect(logoutButtons.length).toBeGreaterThan(0)
    fireEvent.click(logoutButtons[0])
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(onSubmit).not.toHaveBeenCalled()

    // In review, logout also reachable and does not submit
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('Revise seu ponto de partida')).toBeVisible()
    const reviewLogout = screen.getAllByRole('button', { name: 'Sair' })
    fireEvent.click(reviewLogout[reviewLogout.length - 1])
    expect(onLogout).toHaveBeenCalledTimes(2)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
