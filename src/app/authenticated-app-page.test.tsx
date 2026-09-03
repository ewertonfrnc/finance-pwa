import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appMocks = vi.hoisted(() => ({
  signOutLocally: vi.fn<() => Promise<void>>(),
}))

vi.mock('../features/auth/auth-service', () => ({
  signOutLocally: appMocks.signOutLocally,
}))

vi.mock('../features/transactions/transactions-page', () => ({
  TransactionsPage: ({ month }: { month: string }) => (
    <section aria-label="Histórico carregado">{month}</section>
  ),
}))

import { AuthenticatedAppPage } from './authenticated-app-page'

async function renderPage(
  onMonthChange: (month: string) => void = () => undefined,
) {
  const rootRoute = createRootRoute()
  const appRoute = createRoute({
    component: () => (
      <AuthenticatedAppPage
        month="2026-08"
        onMonthChange={onMonthChange}
        userId="user-a"
      />
    ),
    getParentRoute: () => rootRoute,
    path: '/app',
  })
  const transactionCreateRoute = createRoute({
    component: () => <h1>Novo lançamento</h1>,
    getParentRoute: () => rootRoute,
    path: '/app/transactions/new',
  })
  const startingPositionRoute = createRoute({
    component: () => <h1>Ponto de partida</h1>,
    getParentRoute: () => rootRoute,
    path: '/app/starting-position',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/app'] }),
    routeTree: rootRoute.addChildren([
      appRoute,
      transactionCreateRoute,
      startingPositionRoute,
    ]),
  })

  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Agosto de 2026' })
}

describe('AuthenticatedAppPage', () => {
  beforeEach(() => {
    appMocks.signOutLocally.mockReset()
  })

  it('should compose month navigation, workspace actions, and logout', async () => {
    const onMonthChange = vi.fn<(month: string) => void>()
    appMocks.signOutLocally.mockResolvedValue(undefined)
    await renderPage(onMonthChange)

    expect(
      screen.getByRole('heading', { name: 'Agosto de 2026' }),
    ).toBeVisible()
    const startingPositionLink = screen.getByRole('link', {
      name: 'Ponto de partida',
    })
    expect(startingPositionLink).toHaveAttribute(
      'href',
      '/app/starting-position?month=2026-08',
    )
    expect(startingPositionLink.className).toContain('size-11')
    const addButton = screen.getByRole('link', { name: 'Adicionar' })
    expect(addButton).toHaveAttribute(
      'href',
      '/app/transactions/new?month=2026-08',
    )
    addButton.focus()
    expect(addButton).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-07')

    // Keyboard order: previous -> next -> ponto de partida -> sair -> adicionar
    const previousMonthButton = screen.getByRole('button', {
      name: 'Mês anterior',
    })
    const nextMonthButton = screen.getByRole('button', { name: 'Próximo mês' })
    const logoutButton = screen.getByRole('button', { name: 'Sair' })

    // Reset focus and tab through header
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    await screen.findByRole('heading', { name: 'Agosto de 2026' })
    // Tab sequence is deterministic in JSDOM
    startingPositionLink.focus()
    expect(startingPositionLink).toHaveFocus()
    logoutButton.focus()
    expect(logoutButton).toHaveFocus()
    expect(previousMonthButton).toBeVisible()
    expect(nextMonthButton).toBeVisible()

    fireEvent.click(logoutButton)
    expect(
      await screen.findByRole('button', { name: 'Saindo...' }),
    ).toBeDisabled()
    expect(appMocks.signOutLocally).toHaveBeenCalledOnce()
  })

  it('should show safe copy when logout fails', async () => {
    appMocks.signOutLocally.mockRejectedValue(
      new Error('Provider detail must stay hidden'),
    )
    await renderPage()

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Tente novamente.',
    )
    expect(screen.queryByText(/Provider detail/)).not.toBeInTheDocument()
  })
})
