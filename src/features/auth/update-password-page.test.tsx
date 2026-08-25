import type { Session } from '@supabase/supabase-js'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  signOutGlobally: vi.fn<() => Promise<void>>(),
  updatePassword: vi.fn<(password: string) => Promise<void>>(),
}))

vi.mock('./auth-service', () => ({
  signOutGlobally: authServiceMocks.signOutGlobally,
  updatePassword: authServiceMocks.updatePassword,
}))

import type { ResolvedAuthSession } from './auth-session'
import { UpdatePasswordPage } from './update-password-page'

const anonymousAuth = {
  session: null,
  status: 'anonymous',
} satisfies ResolvedAuthSession

const standardAuth = {
  isPasswordRecovery: false,
  session: { user: { email: 'user@example.com', id: 'user-a' } } as Session,
  status: 'authenticated',
} satisfies ResolvedAuthSession

const recoveryAuth = {
  ...standardAuth,
  isPasswordRecovery: true,
} satisfies ResolvedAuthSession

function openUpdatePassword({
  auth = recoveryAuth,
  url = '/auth/update-password',
}: {
  auth?: ResolvedAuthSession
  url?: string
} = {}) {
  window.history.replaceState({}, '', url)
  const onPasswordUpdated = vi.fn<() => void>()
  const result = render(
    <UpdatePasswordPage auth={auth} onPasswordUpdated={onPasswordUpdated} />,
  )

  return { ...result, onPasswordUpdated }
}

function submitPassword({
  confirmation = 'new-password-123',
  password = 'new-password-123',
}: {
  confirmation?: string
  password?: string
} = {}) {
  fireEvent.change(screen.getByLabelText('Nova senha'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText('Confirme a nova senha'), {
    target: { value: confirmation },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }))
}

describe('UpdatePasswordPage', () => {
  beforeEach(() => {
    authServiceMocks.signOutGlobally.mockReset()
    authServiceMocks.updatePassword.mockReset()
  })

  it('should reject a normal authenticated session', () => {
    openUpdatePassword({ auth: standardAuth })

    expect(
      screen.getByRole('heading', {
        name: 'Link de recuperação inválido.',
      }),
    ).toBeVisible()
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()
  })

  it('should remove expired provider details and offer another request', () => {
    openUpdatePassword({
      auth: anonymousAuth,
      url: '/auth/update-password#error=access_denied&error_code=otp_expired&error_description=Provider%20secret',
    })

    expect(window.location.href).toBe(
      `${window.location.origin}/auth/update-password`,
    )
    expect(
      screen.getByRole('heading', { name: 'Este link expirou.' }),
    ).toBeVisible()
    expect(screen.queryByText(/Provider secret/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Solicitar outro link' }),
    ).toHaveAttribute('href', '/forgot-password')
  })

  it('should wait for the recovery event before exposing the form', () => {
    const url =
      '/auth/update-password#access_token=secret&refresh_token=secret&type=recovery'
    const { rerender } = openUpdatePassword({ auth: standardAuth, url })

    expect(window.location.href).toBe(
      `${window.location.origin}/auth/update-password`,
    )
    expect(
      screen.getByRole('heading', { name: 'Validando seu link.' }),
    ).toBeVisible()
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument()

    rerender(
      <UpdatePasswordPage
        auth={recoveryAuth}
        onPasswordUpdated={vi.fn<() => void>()}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Crie uma nova senha.' }),
    ).toBeVisible()
  })

  it('should expose labelled password fields only for a recovery session', () => {
    openUpdatePassword()

    expect(screen.getByLabelText('Nova senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByLabelText('Confirme a nova senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('should reject a short password without submitting', () => {
    openUpdatePassword()

    submitPassword({ confirmation: 'short', password: 'short' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use uma senha com pelo menos 8 caracteres.',
    )
    expect(authServiceMocks.updatePassword).not.toHaveBeenCalled()
  })

  it('should reject mismatched passwords without submitting', () => {
    openUpdatePassword()

    submitPassword({ confirmation: 'different-password' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'As senhas não coincidem.',
    )
    expect(authServiceMocks.updatePassword).not.toHaveBeenCalled()
  })

  it('should update the password, sign out globally, and return to login', async () => {
    authServiceMocks.updatePassword.mockResolvedValue(undefined)
    authServiceMocks.signOutGlobally.mockResolvedValue(undefined)
    const { onPasswordUpdated } = openUpdatePassword()

    submitPassword()

    await waitFor(() =>
      expect(authServiceMocks.updatePassword).toHaveBeenCalledWith(
        'new-password-123',
      ),
    )
    expect(authServiceMocks.signOutGlobally).toHaveBeenCalledOnce()
    expect(onPasswordUpdated).toHaveBeenCalledOnce()
    expect(
      screen.getByRole('heading', { name: 'Finalizando...' }),
    ).toBeVisible()
  })

  it('should map provider failures without exposing their messages', async () => {
    authServiceMocks.updatePassword.mockRejectedValue({
      code: 'unexpected_provider_failure',
      message: 'Provider password detail',
    })
    openUpdatePassword()

    submitPassword()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Tente novamente.',
    )
    expect(
      screen.queryByText(/Provider password detail/),
    ).not.toBeInTheDocument()
    expect(authServiceMocks.signOutGlobally).not.toHaveBeenCalled()
  })

  it('should disclose a safe state when global sign-out fails', async () => {
    authServiceMocks.updatePassword.mockResolvedValue(undefined)
    authServiceMocks.signOutGlobally.mockRejectedValue({
      code: 'unexpected_provider_failure',
      message: 'Provider sign-out detail',
    })
    openUpdatePassword()

    submitPassword()

    expect(
      await screen.findByRole('heading', { name: 'Senha alterada.' }),
    ).toBeVisible()
    expect(screen.getByRole('alert')).not.toHaveTextContent(
      'Provider sign-out detail',
    )
    expect(
      screen.getByRole('link', { name: 'Voltar para o login' }),
    ).toHaveAttribute('href', '/login')
  })
})
