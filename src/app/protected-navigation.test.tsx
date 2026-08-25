import type { Session } from '@supabase/supabase-js'
import { QueryClient } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('../features/auth/auth-service', () => ({
  signInWithEmail:
    vi.fn<(input: { email: string; password: string }) => Promise<unknown>>(),
  registerWithEmail: vi.fn<() => Promise<unknown>>(),
  requestPasswordRecovery: vi.fn<() => Promise<unknown>>(),
  signOutGlobally: vi.fn<() => Promise<void>>(),
  signOutLocally: vi.fn<() => Promise<void>>(),
  updatePassword: vi.fn<() => Promise<void>>(),
}))

import type { ResolvedAuthSession } from '../features/auth/auth-session'
import { routeTree } from '../routeTree.gen'
import type { RouterContext } from './router-context'

function createTestRouter(path: string, auth: ResolvedAuthSession) {
  const context: RouterContext = {
    auth,
    queryClient: new QueryClient(),
  }
  const router = createRouter({
    context,
    history: createMemoryHistory({ initialEntries: [path] }),
    routeTree,
  })

  render(<RouterProvider context={context} router={router} />)

  return router
}

describe('protected navigation', () => {
  it('should redirect an anonymous visitor before private content renders', async () => {
    const router = createTestRouter('/app', {
      session: null,
      status: 'anonymous',
    })

    expect(
      await screen.findByRole('heading', { name: 'Entre na sua conta.' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Seu espaço financeiro começa aqui.',
      }),
    ).not.toBeInTheDocument()
    expect(router.state.location.href).toBe('/login?redirect=%2Fapp')
  })

  it('should send an authenticated user away from login', async () => {
    const session = {
      user: { email: 'user@example.com', id: 'user-a' },
    } as Session
    const router = createTestRouter('/login', {
      isPasswordRecovery: false,
      session,
      status: 'authenticated',
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Seu espaço financeiro começa aqui.',
      }),
    ).toBeVisible()
    expect(screen.getByText('user@example.com')).toBeVisible()
    expect(router.state.location.href).toBe('/app')
  })

  it('should send an authenticated user away from registration', async () => {
    const session = {
      user: { email: 'user@example.com', id: 'user-a' },
    } as Session
    const router = createTestRouter('/register', {
      isPasswordRecovery: false,
      session,
      status: 'authenticated',
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Seu espaço financeiro começa aqui.',
      }),
    ).toBeVisible()
    expect(screen.queryByText('Crie sua conta.')).not.toBeInTheDocument()
    expect(router.state.location.href).toBe('/app')
  })

  it('should keep a recovery session out of the authenticated app', async () => {
    const session = {
      user: { email: 'user@example.com', id: 'user-a' },
    } as Session
    const router = createTestRouter('/app', {
      isPasswordRecovery: true,
      session,
      status: 'authenticated',
    })

    expect(
      await screen.findByRole('heading', { name: 'Crie uma nova senha.' }),
    ).toBeVisible()
    expect(
      screen.queryByRole('heading', {
        name: 'Seu espaço financeiro começa aqui.',
      }),
    ).not.toBeInTheDocument()
    expect(router.state.location.href).toBe('/auth/update-password')
  })

  it('should send an authenticated user away from password recovery', async () => {
    const session = {
      user: { email: 'user@example.com', id: 'user-a' },
    } as Session
    const router = createTestRouter('/forgot-password', {
      isPasswordRecovery: false,
      session,
      status: 'authenticated',
    })

    expect(
      await screen.findByRole('heading', {
        name: 'Seu espaço financeiro começa aqui.',
      }),
    ).toBeVisible()
    expect(router.state.location.href).toBe('/app')
  })
})
