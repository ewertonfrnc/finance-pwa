import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  requestPasswordRecovery:
    vi.fn<(input: { email: string; redirectTo: string }) => Promise<unknown>>(),
}))

vi.mock('./auth-service', () => ({
  requestPasswordRecovery: authServiceMocks.requestPasswordRecovery,
}))

import { ForgotPasswordPage } from './forgot-password-page'

function submitRecovery(email = ' user@example.com ') {
  fireEvent.change(screen.getByLabelText('Email'), {
    target: { value: email },
  })
  fireEvent.click(
    screen.getByRole('button', { name: 'Enviar link de recuperação' }),
  )
}

describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    authServiceMocks.requestPasswordRecovery.mockReset()
    window.history.replaceState({}, '', '/forgot-password')
  })

  it('should expose a labelled email field and a login path', () => {
    render(<ForgotPasswordPage />)

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'autocomplete',
      'email',
    )
    expect(screen.getByRole('link', { name: 'Entrar' })).toHaveAttribute(
      'href',
      '/login',
    )
  })

  it('should request recovery with a trimmed email and current origin callback', async () => {
    authServiceMocks.requestPasswordRecovery.mockResolvedValue(undefined)
    render(<ForgotPasswordPage />)

    submitRecovery()

    await waitFor(() =>
      expect(authServiceMocks.requestPasswordRecovery).toHaveBeenCalledWith({
        email: 'user@example.com',
        redirectTo: `${window.location.origin}/auth/update-password`,
      }),
    )
    expect(
      screen.getByRole('heading', { name: 'Confira seu email.' }),
    ).toBeVisible()
    expect(screen.getByRole('status')).toHaveTextContent(
      'Se houver uma conta com esse email, você receberá um link para criar uma nova senha.',
    )
  })

  it('should show pending state while the request is being sent', async () => {
    let finishRequest: (() => void) | undefined
    authServiceMocks.requestPasswordRecovery.mockImplementation(
      () =>
        new Promise((resolve) => {
          finishRequest = () => resolve(undefined)
        }),
    )
    render(<ForgotPasswordPage />)

    submitRecovery()

    expect(
      await screen.findByRole('button', { name: 'Enviando...' }),
    ).toBeDisabled()
    finishRequest?.()
  })

  it('should map rate limits without exposing the provider message', async () => {
    authServiceMocks.requestPasswordRecovery.mockRejectedValue({
      code: 'over_email_send_rate_limit',
      message: 'Provider email quota detail',
    })
    render(<ForgotPasswordPage />)

    submitRecovery()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Muitas tentativas em pouco tempo. Aguarde um pouco e tente novamente.',
    )
    expect(
      screen.queryByText(/Provider email quota detail/),
    ).not.toBeInTheDocument()
  })

  it('should hide unknown provider failures', async () => {
    authServiceMocks.requestPasswordRecovery.mockRejectedValue({
      code: 'unexpected_provider_failure',
      message: 'Provider internal detail',
    })
    render(<ForgotPasswordPage />)

    submitRecovery()

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível concluir. Tente novamente.',
    )
    expect(
      screen.queryByText(/Provider internal detail/),
    ).not.toBeInTheDocument()
  })
})
