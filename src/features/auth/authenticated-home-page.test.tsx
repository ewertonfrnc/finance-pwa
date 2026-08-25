import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const authServiceMocks = vi.hoisted(() => ({
  signOutLocally: vi.fn<() => Promise<void>>(),
}))

vi.mock('./auth-service', () => ({
  signOutLocally: authServiceMocks.signOutLocally,
}))

import { AuthenticatedHomePage } from './authenticated-home-page'

describe('AuthenticatedHomePage', () => {
  beforeEach(() => {
    authServiceMocks.signOutLocally.mockReset()
  })

  it('should show the current account and submit logout', async () => {
    authServiceMocks.signOutLocally.mockResolvedValue(undefined)
    render(<AuthenticatedHomePage email="user@example.com" />)

    expect(screen.getByText('user@example.com')).toBeVisible()
    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(
      await screen.findByRole('button', { name: 'Saindo...' }),
    ).toBeDisabled()
    expect(authServiceMocks.signOutLocally).toHaveBeenCalledOnce()
  })

  it('should show safe copy when logout fails', async () => {
    authServiceMocks.signOutLocally.mockRejectedValue(
      new Error('Provider detail must stay hidden'),
    )
    render(<AuthenticatedHomePage email="user@example.com" />)

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Tente novamente.',
    )
    expect(screen.queryByText(/Provider detail/)).not.toBeInTheDocument()
  })
})
