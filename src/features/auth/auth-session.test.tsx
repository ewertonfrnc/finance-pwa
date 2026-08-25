import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen } from '@testing-library/react'
import { useEffect, useState, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  observeAuthState:
    vi.fn<
      (
        listener: (event: AuthChangeEvent, session: Session | null) => void,
      ) => () => void
    >(),
  unsubscribe: vi.fn<() => void>(),
}))

vi.mock('./auth-service', () => ({
  observeAuthState: authServiceMocks.observeAuthState,
}))

import { AuthSessionProvider, useAuthSession } from './auth-session'

let emitAuthState: (event: AuthChangeEvent, session: Session | null) => void

function createSession(userId: string, email: string) {
  return { user: { email, id: userId } } as Session
}

function SessionProbe() {
  const auth = useAuthSession()

  return (
    <>
      <p>
        {auth.status === 'authenticated'
          ? `${auth.status}:${auth.session.user.email}`
          : auth.status}
      </p>
      {auth.status === 'authenticated' ? (
        <p>{auth.isPasswordRecovery ? 'recovery' : 'standard'}</p>
      ) : null}
    </>
  )
}

function readAccountCache(queryClient: QueryClient) {
  return queryClient.getQueryData<string>(['current-account']) ?? 'sem cache'
}

function CacheProbe({ queryClient }: { queryClient: QueryClient }) {
  const [cachedAccount, setCachedAccount] = useState(() =>
    readAccountCache(queryClient),
  )

  useEffect(
    () =>
      queryClient
        .getQueryCache()
        .subscribe(() => setCachedAccount(readAccountCache(queryClient))),
    [queryClient],
  )

  return <p>Cache: {cachedAccount}</p>
}

function renderSession(
  children: ReactNode = <SessionProbe />,
  queryClient = new QueryClient(),
) {
  return {
    queryClient,
    ...render(
      <QueryClientProvider client={queryClient}>
        <AuthSessionProvider>{children}</AuthSessionProvider>
      </QueryClientProvider>,
    ),
  }
}

describe('AuthSessionProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    authServiceMocks.observeAuthState.mockReset()
    authServiceMocks.unsubscribe.mockReset()
    authServiceMocks.observeAuthState.mockImplementation((listener) => {
      emitAuthState = listener
      return authServiceMocks.unsubscribe
    })
  })

  it('should remain unresolved until the initial auth event arrives', () => {
    renderSession()

    expect(screen.getByText('resolving')).toBeVisible()

    act(() => emitAuthState('INITIAL_SESSION', null))

    expect(screen.getByText('anonymous')).toBeVisible()
  })

  it('should restore the authenticated user from the initial session', () => {
    renderSession()

    act(() =>
      emitAuthState(
        'INITIAL_SESSION',
        createSession('user-a', 'user-a@example.com'),
      ),
    )

    expect(screen.getByText('authenticated:user-a@example.com')).toBeVisible()
    expect(screen.getByText('standard')).toBeVisible()
  })

  it('should retain password recovery through user updates and token refreshes', () => {
    renderSession()
    const session = createSession('user-a', 'user-a@example.com')

    act(() => emitAuthState('INITIAL_SESSION', session))
    act(() => emitAuthState('PASSWORD_RECOVERY', session))

    expect(screen.getByText('recovery')).toBeVisible()

    act(() => emitAuthState('USER_UPDATED', session))
    act(() => emitAuthState('TOKEN_REFRESHED', session))

    expect(screen.getByText('recovery')).toBeVisible()
  })

  it('should restore password recovery after the provider remounts', () => {
    const session = createSession('user-a', 'user-a@example.com')
    const firstRender = renderSession()

    act(() => emitAuthState('PASSWORD_RECOVERY', session))
    expect(screen.getByText('recovery')).toBeVisible()

    firstRender.unmount()
    renderSession()
    act(() => emitAuthState('INITIAL_SESSION', session))

    expect(screen.getByText('recovery')).toBeVisible()
  })

  it('should clear password recovery when a different user signs in', () => {
    renderSession()
    const firstSession = createSession('user-a', 'user-a@example.com')
    const secondSession = createSession('user-b', 'user-b@example.com')

    act(() => emitAuthState('PASSWORD_RECOVERY', firstSession))
    act(() => emitAuthState('SIGNED_IN', secondSession))

    expect(screen.getByText('authenticated:user-b@example.com')).toBeVisible()
    expect(screen.getByText('standard')).toBeVisible()
  })

  it('should preserve cached data for refreshes from the same user', () => {
    const queryClient = new QueryClient()
    queryClient.setQueryData(['current-account'], 'Conta do usuário A')
    renderSession(<CacheProbe queryClient={queryClient} />, queryClient)
    const session = createSession('user-a', 'user-a@example.com')

    act(() => emitAuthState('INITIAL_SESSION', session))
    act(() => emitAuthState('TOKEN_REFRESHED', session))

    expect(screen.getByText('Cache: Conta do usuário A')).toBeVisible()
  })

  it('should remove cached data before a different user becomes visible', () => {
    const queryClient = new QueryClient()
    const firstSession = createSession('user-a', 'user-a@example.com')
    const secondSession = createSession('user-b', 'user-b@example.com')
    renderSession(
      <>
        <SessionProbe />
        <CacheProbe queryClient={queryClient} />
      </>,
      queryClient,
    )

    act(() => emitAuthState('INITIAL_SESSION', firstSession))
    act(() =>
      queryClient.setQueryData(['current-account'], 'Conta do usuário A'),
    )
    expect(screen.getByText('Cache: Conta do usuário A')).toBeVisible()

    act(() => emitAuthState('SIGNED_IN', secondSession))

    expect(screen.getByText('authenticated:user-b@example.com')).toBeVisible()
    expect(screen.getByText('Cache: sem cache')).toBeVisible()
  })

  it('should remove cached data when the user signs out', () => {
    const queryClient = new QueryClient()
    renderSession(
      <>
        <SessionProbe />
        <CacheProbe queryClient={queryClient} />
      </>,
      queryClient,
    )

    act(() =>
      emitAuthState(
        'INITIAL_SESSION',
        createSession('user-a', 'user-a@example.com'),
      ),
    )
    act(() =>
      queryClient.setQueryData(['current-account'], 'Conta do usuário A'),
    )
    act(() => emitAuthState('SIGNED_OUT', null))

    expect(screen.getByText('anonymous')).toBeVisible()
    expect(screen.getByText('Cache: sem cache')).toBeVisible()
  })

  it('should stop observing auth events when it unmounts', () => {
    const { unmount } = renderSession()

    unmount()

    expect(authServiceMocks.unsubscribe).toHaveBeenCalledOnce()
  })
})
