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

const supabaseMocks = vi.hoisted(() => {
  return {
    rpc: vi.fn<() => Promise<{ data: unknown; error: unknown }>>(),
    from: vi.fn<() => unknown>(() => ({
      abortSignal: vi
        .fn<() => unknown>()
        .mockReturnValue({ maybeSingle: vi.fn<() => unknown>() }),
      select: vi.fn<() => unknown>().mockReturnThis(),
    })),
  }
})

vi.mock('../../lib/supabase/client', () => ({
  supabase: { from: supabaseMocks.from, rpc: supabaseMocks.rpc },
}))

vi.mock('../../lib/use-network-status', () => ({
  useNetworkStatus: () => true,
}))

import { UnsavedChangesProvider } from '../../app/unsaved-changes'
import { StartingPositionPage } from './starting-position-page'

function typeAmount(digits: string) {
  const input = screen.getByLabelText('Saldo inicial') as HTMLInputElement
  for (const digit of digits) {
    fireEvent.change(input, { target: { value: `${input.value}${digit}` } })
  }
}

async function renderPage({
  onAlreadySaved = vi.fn<() => void>(),
  onComplete = vi.fn<() => void>(),
  onLogout = vi.fn<() => void>(),
  userId = 'user-a',
}: {
  onAlreadySaved?: () => void
  onComplete?: () => void
  onLogout?: () => void
  userId?: string
} = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const rootRoute = createRootRoute({ component: () => <Outlet /> })
  const pageRoute = createRoute({
    component: () => (
      <StartingPositionPage
        onAlreadySaved={onAlreadySaved}
        onComplete={onComplete}
        onLogout={onLogout}
        userId={userId}
      />
    ),
    getParentRoute: () => rootRoute,
    path: '/',
  })
  const router = createRouter({
    history: createMemoryHistory({ initialEntries: ['/'] }),
    routeTree: rootRoute.addChildren([pageRoute]),
  })

  render(
    <QueryClientProvider client={queryClient}>
      <UnsavedChangesProvider>
        <RouterProvider router={router as never} />
      </UnsavedChangesProvider>
    </QueryClientProvider>,
  )

  await screen.findByRole('heading', { name: 'Ponto de partida' })
  return { onComplete, onLogout, queryClient }
}

describe('StartingPositionPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should confirm the signed payload and call onComplete on success', async () => {
    const onComplete = vi.fn<() => void>()
    supabaseMocks.rpc.mockResolvedValue({
      data: {
        balance_cents: 5000,
        created_at: '2026-08-27T12:00:00Z',
        effective_on: '2026-08-27',
        user_id: 'user-a',
      },
      error: null,
    })

    await renderPage({ onComplete })
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('R$ 50,00')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar ponto de partida' }),
    )

    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
    expect(supabaseMocks.rpc).toHaveBeenCalledWith(
      'initialize_starting_position',
      {
        p_balance_cents: 5000,
        p_effective_on: expect.any(String),
      },
    )
  })

  it('should keep the review values and show mapped copy after a generic failure', async () => {
    const onComplete = vi.fn<() => void>()
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '22023', message: 'balance_cents_out_of_range' },
    })

    await renderPage({ onComplete })
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('R$ 50,00')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar ponto de partida' }),
    )

    expect(await screen.findByText('Informe um saldo suportado.')).toBeVisible()
    expect(screen.getByText('R$ 50,00')).toBeVisible()
    expect(onComplete).not.toHaveBeenCalled()

    // Retry should send same payload again
    supabaseMocks.rpc.mockResolvedValueOnce({
      data: {
        balance_cents: 5000,
        created_at: '2026-08-27T12:00:00Z',
        effective_on: '2026-08-27',
        user_id: 'user-a',
      },
      error: null,
    })
    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar ponto de partida' }),
    )
    await waitFor(() => expect(onComplete).toHaveBeenCalledTimes(1))
  })

  it('should map authentication and permission errors without provider details', async () => {
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'authentication_required' },
    })

    await renderPage()
    typeAmount('1000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    fireEvent.click(
      await screen.findByRole('button', { name: 'Confirmar ponto de partida' }),
    )

    expect(
      await screen.findByText(
        'Sua sessão expirou. Entre novamente para continuar.',
      ),
    ).toBeVisible()

    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '42501', message: 'permission denied' },
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar ponto de partida' }),
    )
    expect(
      await screen.findByText('Você não tem permissão para esta ação.'),
    ).toBeVisible()
  })

  it('should keep logout reachable and never submit while in review', async () => {
    const onLogout = vi.fn<() => void>()
    const onComplete = vi.fn<() => void>()
    supabaseMocks.rpc.mockResolvedValue({ data: null, error: null })

    await renderPage({ onComplete, onLogout })
    typeAmount('3000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('R$ 30,00')).toBeVisible()

    fireEvent.click(screen.getAllByRole('button', { name: 'Sair' })[0])
    expect(onLogout).toHaveBeenCalledTimes(1)
    expect(supabaseMocks.rpc).not.toHaveBeenCalled()
  })

  it('should refetch the authoritative row and call onAlreadySaved on 23505', async () => {
    const onAlreadySaved = vi.fn<() => void>()
    const onComplete = vi.fn<() => void>()
    supabaseMocks.rpc.mockResolvedValue({
      data: null,
      error: { code: '23505', message: 'starting_position_already_exists' },
    })
    supabaseMocks.from.mockImplementation(
      () =>
        ({
          abortSignal: vi.fn<() => unknown>().mockReturnValue({
            maybeSingle: vi.fn<() => unknown>().mockResolvedValue({
              data: {
                balance_cents: 9999,
                created_at: '2026-08-27T12:00:00Z',
                effective_on: '2026-08-27',
                user_id: 'user-a',
              },
              error: null,
            }),
          }),
          select: vi.fn<() => unknown>().mockReturnThis(),
        }) as never,
    )

    await renderPage({ onAlreadySaved, onComplete })
    typeAmount('5000')
    fireEvent.click(screen.getByRole('button', { name: 'Revisar' }))
    expect(await screen.findByText('R$ 50,00')).toBeVisible()

    fireEvent.click(
      screen.getByRole('button', { name: 'Confirmar ponto de partida' }),
    )

    await waitFor(() => expect(onAlreadySaved).toHaveBeenCalledTimes(1))
    expect(onComplete).not.toHaveBeenCalled()
    expect(
      screen.queryByText('Um ponto de partida já foi salvo'),
    ).not.toBeInTheDocument()
  })
})
