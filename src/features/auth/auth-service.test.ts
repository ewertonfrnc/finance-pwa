import type { AuthChangeEvent, Session } from '@supabase/supabase-js'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  onAuthStateChange: vi.fn<
    (listener: (event: AuthChangeEvent, session: Session | null) => void) => {
      data: { subscription: { unsubscribe: () => void } }
    }
  >(),
  resetPasswordForEmail:
    vi.fn<
      (
        email: string,
        options: { redirectTo: string },
      ) => Promise<{ data: object | null; error: unknown }>
    >(),
  signInWithPassword: vi.fn<
    (input: { email: string; password: string }) => Promise<{
      data: { session?: Session | null }
      error: unknown
    }>
  >(),
  signUp: vi.fn<
    (input: {
      email: string
      options: { emailRedirectTo: string }
      password: string
    }) => Promise<{
      data: { session: Session | null; user: null }
      error: unknown
    }>
  >(),
  signOut:
    vi.fn<
      (input: { scope: 'global' | 'local' }) => Promise<{ error: unknown }>
    >(),
  unsubscribe: vi.fn<() => void>(),
  updateUser: vi.fn<
    (input: { password: string }) => Promise<{
      data: { user: unknown }
      error: unknown
    }>
  >(),
}))

vi.mock('../../lib/supabase/client', () => ({
  supabase: {
    auth: {
      onAuthStateChange: authMocks.onAuthStateChange,
      resetPasswordForEmail: authMocks.resetPasswordForEmail,
      signInWithPassword: authMocks.signInWithPassword,
      signUp: authMocks.signUp,
      signOut: authMocks.signOut,
      updateUser: authMocks.updateUser,
    },
  },
}))

import {
  observeAuthState,
  registerWithEmail,
  requestPasswordRecovery,
  signInWithEmail,
  signOutGlobally,
  signOutLocally,
  updatePassword,
} from './auth-service'

describe('auth service', () => {
  beforeEach(() => {
    authMocks.onAuthStateChange.mockReset()
    authMocks.resetPasswordForEmail.mockReset()
    authMocks.signInWithPassword.mockReset()
    authMocks.signUp.mockReset()
    authMocks.signOut.mockReset()
    authMocks.unsubscribe.mockReset()
    authMocks.updateUser.mockReset()
  })

  it('should expose auth events and release the subscription', () => {
    authMocks.onAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: authMocks.unsubscribe } },
    })
    const listener =
      vi.fn<(event: AuthChangeEvent, session: Session | null) => void>()

    const stopObserving = observeAuthState(listener)
    stopObserving()

    expect(authMocks.onAuthStateChange).toHaveBeenCalledWith(listener)
    expect(authMocks.unsubscribe).toHaveBeenCalledOnce()
  })

  it('should submit email credentials and return the restored session', async () => {
    const session = { user: { id: 'user-a' } } as Session
    authMocks.signInWithPassword.mockResolvedValue({
      data: { session },
      error: null,
    })

    await expect(
      signInWithEmail({ email: 'user@example.com', password: 'password-123' }),
    ).resolves.toBe(session)
    expect(authMocks.signInWithPassword).toHaveBeenCalledWith({
      email: 'user@example.com',
      password: 'password-123',
    })
  })

  it('should surface the provider error without exposing it as copy', async () => {
    const error = { code: 'invalid_credentials', message: 'Provider detail' }
    authMocks.signInWithPassword.mockResolvedValue({ data: {}, error })

    await expect(
      signInWithEmail({ email: 'user@example.com', password: 'wrong-pass' }),
    ).rejects.toBe(error)
  })

  it('should register with the callback from the current application origin', async () => {
    const data = { session: null, user: null }
    authMocks.signUp.mockResolvedValue({ data, error: null })

    await expect(
      registerWithEmail({
        email: 'user@example.com',
        emailRedirectTo: 'https://preview.example.com/auth/confirm',
        password: 'password-123',
      }),
    ).resolves.toBe(data)
    expect(authMocks.signUp).toHaveBeenCalledWith({
      email: 'user@example.com',
      options: {
        emailRedirectTo: 'https://preview.example.com/auth/confirm',
      },
      password: 'password-123',
    })
  })

  it('should surface registration failures for safe copy mapping', async () => {
    const error = { code: 'weak_password', message: 'Provider detail' }
    authMocks.signUp.mockResolvedValue({
      data: { session: null, user: null },
      error,
    })

    await expect(
      registerWithEmail({
        email: 'user@example.com',
        emailRedirectTo: 'http://localhost/auth/confirm',
        password: 'short',
      }),
    ).rejects.toBe(error)
  })

  it('should request recovery with the callback from the current application origin', async () => {
    authMocks.resetPasswordForEmail.mockResolvedValue({ data: {}, error: null })

    await requestPasswordRecovery({
      email: 'user@example.com',
      redirectTo: 'https://preview.example.com/auth/update-password',
    })

    expect(authMocks.resetPasswordForEmail).toHaveBeenCalledWith(
      'user@example.com',
      { redirectTo: 'https://preview.example.com/auth/update-password' },
    )
  })

  it('should surface recovery request failures for safe copy mapping', async () => {
    const error = {
      code: 'over_email_send_rate_limit',
      message: 'Provider detail',
    }
    authMocks.resetPasswordForEmail.mockResolvedValue({ data: null, error })

    await expect(
      requestPasswordRecovery({
        email: 'user@example.com',
        redirectTo: 'http://localhost/auth/update-password',
      }),
    ).rejects.toBe(error)
  })

  it('should update the current recovery session password', async () => {
    authMocks.updateUser.mockResolvedValue({
      data: { user: { id: 'user-a' } },
      error: null,
    })

    await updatePassword('new-password-123')

    expect(authMocks.updateUser).toHaveBeenCalledWith({
      password: 'new-password-123',
    })
  })

  it('should limit ordinary logout to the current session', async () => {
    authMocks.signOut.mockResolvedValue({ error: null })

    await signOutLocally()

    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'local' })
  })

  it('should revoke every refresh token after password replacement', async () => {
    authMocks.signOut.mockResolvedValue({ error: null })

    await signOutGlobally()

    expect(authMocks.signOut).toHaveBeenCalledWith({ scope: 'global' })
  })
})
