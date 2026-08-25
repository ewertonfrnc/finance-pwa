import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  registerWithEmail:
    vi.fn<
      (input: {
        email: string
        emailRedirectTo: string
        password: string
      }) => Promise<unknown>
    >(),
}))

vi.mock('./auth-service', () => ({
  registerWithEmail: authServiceMocks.registerWithEmail,
}))

import { RegisterPage } from './register-page'

function fillRegistration({
  confirmation = 'password-123',
  password = 'password-123',
}: {
  confirmation?: string
  password?: string
} = {}) {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: ' user@example.com ' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: password },
  })
  fireEvent.change(screen.getByLabelText('Confirme a senha'), {
    target: { value: confirmation },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
}

describe('RegisterPage', () => {
  beforeEach(() => {
    authServiceMocks.registerWithEmail.mockReset()
    window.history.replaceState({}, '', '/')
  })

  it('should expose labelled fields with registration autocomplete values', () => {
    render(<RegisterPage />)

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText('Senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    expect(screen.getByLabelText('Confirme a senha')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
  })

  it('should reject a password shorter than eight characters without submitting', () => {
    render(<RegisterPage />)

    fillRegistration({ confirmation: 'short', password: 'short' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Use uma senha com pelo menos 8 caracteres.',
    )
    expect(authServiceMocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('should reject mismatched passwords without submitting', () => {
    render(<RegisterPage />)

    fillRegistration({ confirmation: 'different-password' })

    expect(screen.getByRole('alert')).toHaveTextContent(
      'As senhas não coincidem.',
    )
    expect(authServiceMocks.registerWithEmail).not.toHaveBeenCalled()
  })

  it('should register with a trimmed email and the current origin callback', async () => {
    authServiceMocks.registerWithEmail.mockResolvedValue(undefined)
    render(<RegisterPage />)

    fillRegistration()

    await waitFor(() =>
      expect(authServiceMocks.registerWithEmail).toHaveBeenCalledWith({
        email: 'user@example.com',
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        password: 'password-123',
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Confira seu email.' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent('user@example.com')
  })

  it('should show the same completion state for an existing account', async () => {
    authServiceMocks.registerWithEmail.mockRejectedValue({
      code: 'user_already_exists',
      message: 'User already registered from provider',
    })
    render(<RegisterPage />)

    fillRegistration()

    expect(
      await screen.findByRole('heading', { name: 'Confira seu email.' }),
    ).toBeVisible()
    expect(
      screen.queryByText(/User already registered from provider/),
    ).not.toBeInTheDocument()
  })

  it('should show pending state while the account is being created', async () => {
    let finishRegistration: (() => void) | undefined
    authServiceMocks.registerWithEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRegistration = () => resolve(undefined)
        }),
    )
    render(<RegisterPage />)

    fillRegistration()

    expect(
      await screen.findByRole('button', { name: 'Criando conta...' }),
    ).toBeDisabled()
    finishRegistration?.()
  })

  it('should map rate limits without exposing the provider message', async () => {
    authServiceMocks.registerWithEmail.mockRejectedValue({
      code: 'over_email_send_rate_limit',
      message: 'Provider email quota detail',
    })
    render(<RegisterPage />)

    fillRegistration()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.',
    )
    expect(
      screen.queryByText(/Provider email quota detail/),
    ).not.toBeInTheDocument()
  })
})
