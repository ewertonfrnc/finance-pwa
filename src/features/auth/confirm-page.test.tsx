import type { Session } from '@supabase/supabase-js'
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ResolvedAuthSession } from './auth-session'
import { ConfirmPage } from './confirm-page'

const anonymousAuth = {
  session: null,
  status: 'anonymous',
} satisfies ResolvedAuthSession

function openConfirmation(
  url: string,
  auth: ResolvedAuthSession = anonymousAuth,
) {
  window.history.replaceState({}, '', url)
  const onConfirmed = vi.fn<() => void>()
  render(<ConfirmPage auth={auth} onConfirmed={onConfirmed} />)
  return onConfirmed
}

describe('ConfirmPage', () => {
  it('should clean callback tokens before opening the authenticated app', async () => {
    const auth = {
      session: {
        user: { email: 'user@example.com', id: 'user-a' },
      } as Session,
      status: 'authenticated',
    } satisfies ResolvedAuthSession
    const onConfirmed = openConfirmation(
      '/auth/confirm#access_token=secret&refresh_token=secret',
      auth,
    )

    expect(window.location.href).toBe(`${window.location.origin}/auth/confirm`)
    expect(
      screen.getByRole('heading', { name: 'Email confirmado.' }),
    ).toBeVisible()
    await waitFor(() => expect(onConfirmed).toHaveBeenCalledOnce())
  })

  it('should show an expired state and remove provider details from the URL', () => {
    openConfirmation(
      '/auth/confirm#error=access_denied&error_code=otp_expired&error_description=Provider%20secret',
    )

    expect(window.location.href).toBe(`${window.location.origin}/auth/confirm`)
    expect(
      screen.getByRole('heading', { name: 'Este link expirou.' }),
    ).toBeVisible()
    expect(screen.queryByText(/Provider secret/)).not.toBeInTheDocument()
    expect(
      screen.getByRole('link', { name: 'Voltar ao cadastro' }),
    ).toHaveAttribute('href', '/register')
  })

  it('should show a safe state for a malformed callback', () => {
    openConfirmation('/auth/confirm')

    expect(
      screen.getByRole('heading', {
        name: 'Link de confirmação inválido.',
      }),
    ).toBeVisible()
  })

  it('should show a safe state when confirmation is denied', () => {
    openConfirmation(
      '/auth/confirm#error=access_denied&error_code=signup_disabled&error_description=Provider%20detail',
    )

    expect(
      screen.getByRole('heading', { name: 'Não foi possível confirmar.' }),
    ).toBeVisible()
    expect(screen.queryByText(/Provider detail/)).not.toBeInTheDocument()
  })
})
