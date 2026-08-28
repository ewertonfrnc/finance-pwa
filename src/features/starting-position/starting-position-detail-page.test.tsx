import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  RouterProvider,
} from '@tanstack/react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const networkMocks = vi.hoisted(() => ({ isOnline: true }))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => networkMocks.isOnline,
}))

const startingPositionMocks = vi.hoisted(() => ({
  readStartingPosition: vi.fn<() => Promise<unknown>>(),
}))

vi.mock('./starting-position-service', () => ({
  readStartingPosition: startingPositionMocks.readStartingPosition,
  initializeStartingPosition: vi.fn<() => Promise<unknown>>(),
}))

import { startingPositionQueryKeys } from './starting-position-queries'
import { StartingPositionDetailPage } from './starting-position-detail-page'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
}

async function renderDetail({
  backMonth = '2026-08',
  notice = null,
  userId = 'user-a',
  queryClient = createQueryClient(),
}: {
  backMonth?: string
  notice?: string | null
  queryClient?: QueryClient
  userId?: string
} = {}) {
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const detailRoute = createRoute({
    component: () => (
      <StartingPositionDetailPage
        backMonth={backMonth}
        notice={notice}
        userId={userId}
      />
    ),
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const appRoute = createRoute({
    component: () => <h1>Lançamentos</h1>,
    getParentRoute: () => rootRoute,
    path: '/app',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([detailRoute, appRoute]),
  })

  render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router as never} />
    </QueryClientProvider>,
  )

  await screen.findByRole('heading', { name: 'Ponto de partida' })
  return { queryClient, router }
}

describe('StartingPositionDetailPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    networkMocks.isOnline = true
    startingPositionMocks.readStartingPosition.mockResolvedValue({
      balance_cents: 12345,
      created_at: '2026-08-27T12:00:00Z',
      effective_on: '2026-08-27',
      user_id: 'user-a',
    })
  })

  it('should show the signed BRL value, localized date, semantics, and back path', async () => {
    await renderDetail({ backMonth: '2026-08' })

    expect(await screen.findByText('R$ 123,45')).toBeVisible()
    expect(screen.getByText('2026-08-27')).toBeVisible()
    // Long date appears in the date field and in the semantics paragraph
    expect(screen.getAllByText(/27 de agosto de 2026/i)).toHaveLength(2)
    expect(
      screen.getByText(/Lançamentos do mesmo dia entram depois dele/),
    ).toBeVisible()
    expect(
      screen.getByText(/Esse valor não pode ser alterado nesta versão/),
    ).toBeVisible()

    const backLinks = screen.getAllByRole('link', {
      name: 'Voltar para lançamentos',
    })
    expect(backLinks).toHaveLength(2)
    expect(backLinks[0]).toHaveAttribute('href', '/app?month=2026-08')
    expect(backLinks[1]).toHaveAttribute('href', '/app?month=2026-08')

    // Clicking back should navigate
    fireEvent.click(backLinks[1])
    await waitFor(() => expect(screen.getByText('Lançamentos')).toBeVisible())
  })

  it('should render the authoritative cached row without a second fetch when already available', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(startingPositionQueryKeys.byUser('user-a'), {
      balance_cents: 5000,
      created_at: '2026-08-27T12:00:00Z',
      effective_on: '2026-08-27',
      user_id: 'user-a',
    })

    await renderDetail({ queryClient })

    expect(await screen.findByText('R$ 50,00')).toBeVisible()
    // Service should not have been called because cache was already seeded
    expect(startingPositionMocks.readStartingPosition).not.toHaveBeenCalled()
  })

  it('should show already-saved notice without implying the rejected draft was accepted', async () => {
    const queryClient = createQueryClient()
    queryClient.setQueryData(startingPositionQueryKeys.byUser('user-a'), {
      balance_cents: 9999,
      created_at: '2026-08-27T12:00:00Z',
      effective_on: '2026-08-27',
      user_id: 'user-a',
    })

    await renderDetail({ notice: 'already-saved', queryClient })

    expect(
      await screen.findByText(
        'Um ponto de partida já foi salvo com outros valores.',
      ),
    ).toBeVisible()
    expect(screen.getByText(/O valor exibido abaixo foi mantido/)).toBeVisible()
    expect(screen.getByText('R$ 99,99')).toBeVisible()
    expect(screen.queryByText('R$ 50,00')).not.toBeInTheDocument()
  })

  it('should show offline and retry states without trapping the user', async () => {
    networkMocks.isOnline = false
    startingPositionMocks.readStartingPosition.mockRejectedValue(
      new Error('Provider detail must stay hidden'),
    )

    await renderDetail()

    expect(await screen.findByText('Você está offline')).toBeVisible()
    expect(screen.queryByText(/Provider detail/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Tentar novamente' }),
    ).toBeVisible()

    // Go online and succeed
    networkMocks.isOnline = true
    startingPositionMocks.readStartingPosition.mockResolvedValue({
      balance_cents: 2500,
      created_at: '2026-08-27T12:00:00Z',
      effective_on: '2026-08-27',
      user_id: 'user-a',
    })

    fireEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('R$ 25,00')).toBeVisible()
  })

  it('should keep 44 by 44 targets, visible focus, and accessible names', async () => {
    await renderDetail()

    const backLinks = screen.getAllByRole('link', {
      name: 'Voltar para lançamentos',
    })
    const headerLink = backLinks[0]
    const footerLink = backLinks[1]
    headerLink.focus()
    expect(headerLink).toHaveFocus()
    // Header link keeps 44x44 via size-11, footer keeps min-h-11
    expect(headerLink.className).toContain('size-11')
    expect(footerLink.className).toContain('min-h-11')
    footerLink.focus()
    expect(footerLink).toHaveFocus()
  })
})
