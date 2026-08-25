import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  signInWithEmail:
    vi.fn<(input: { email: string; password: string }) => Promise<unknown>>(),
}))

vi.mock('./auth-service', () => ({
  signInWithEmail: authServiceMocks.signInWithEmail,
}))

import { LoginPage } from './login-page'

function fillAndSubmit() {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: ' user@example.com ' },
  })
  fireEvent.change(screen.getByLabelText('Senha'), {
    target: { value: 'password-123' },
  })
  fireEvent.click(screen.getByRole('button', { name: 'Entrar' }))
}

describe('LoginPage', () => {
  beforeEach(() => {
    authServiceMocks.signInWithEmail.mockReset()
  })

  it('should expose labelled fields with the expected autocomplete values', () => {
    render(<LoginPage onSignedIn={vi.fn<() => void>()} />)

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByLabelText('Senha')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    expect(
      screen.getByRole('link', { name: 'Esqueci minha senha' }),
    ).toHaveAttribute('href', '/forgot-password')
  })

  it('should show a safe password replacement notice', () => {
    render(
      <LoginPage notice="password-updated" onSignedIn={vi.fn<() => void>()} />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(
      'Senha alterada. Entre com sua nova senha.',
    )
  })

  it('should submit trimmed email credentials and the requested internal path', async () => {
    authServiceMocks.signInWithEmail.mockResolvedValue(undefined)
    const onSignedIn = vi.fn<(destination: string) => void>()
    render(<LoginPage onSignedIn={onSignedIn} redirect="/app?month=2026-08" />)

    fillAndSubmit()

    await waitFor(() =>
      expect(authServiceMocks.signInWithEmail).toHaveBeenCalledWith({
        email: 'user@example.com',
        password: 'password-123',
      }),
    )
    expect(onSignedIn).toHaveBeenCalledWith('/app?month=2026-08')
  })

  it.each([
    'https://example.com/account',
    '//example.com/account',
    '/\\example.com/account',
    'not-a-path',
  ])('should replace unsafe redirect %s with /app', async (redirect) => {
    authServiceMocks.signInWithEmail.mockResolvedValue(undefined)
    const onSignedIn = vi.fn<(destination: string) => void>()
    render(<LoginPage onSignedIn={onSignedIn} redirect={redirect} />)

    fillAndSubmit()

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('/app'))
  })

  it('should show pending state while credentials are being checked', async () => {
    let finishLogin: (() => void) | undefined
    authServiceMocks.signInWithEmail.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishLogin = () => resolve(undefined)
        }),
    )
    render(<LoginPage onSignedIn={vi.fn<() => void>()} />)

    fillAndSubmit()

    expect(
      await screen.findByRole('button', { name: 'Entrando...' }),
    ).toBeDisabled()
    finishLogin?.()
  })

  it('should show safe copy instead of the provider message', async () => {
    authServiceMocks.signInWithEmail.mockRejectedValue({
      code: 'invalid_credentials',
      message: 'Invalid login credentials from provider',
    })
    render(<LoginPage onSignedIn={vi.fn<() => void>()} />)

    fillAndSubmit()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email ou senha inválidos',
    )
    expect(
      screen.queryByText(/Invalid login credentials/),
    ).not.toBeInTheDocument()
  })
})
