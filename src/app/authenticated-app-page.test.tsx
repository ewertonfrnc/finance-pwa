import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const appMocks = vi.hoisted(() => ({
  signOutLocally: vi.fn<() => Promise<void>>(),
}))

vi.mock('../features/auth/auth-service', () => ({
  signOutLocally: appMocks.signOutLocally,
}))

vi.mock('../features/transactions/transactions-page', () => ({
  TransactionsPage: ({ month }: { month: string }) => (
    <section aria-label="Histórico carregado">{month}</section>
  ),
}))

import { AuthenticatedAppPage } from './authenticated-app-page'

describe('AuthenticatedAppPage', () => {
  beforeEach(() => {
    appMocks.signOutLocally.mockReset()
  })

  it('should compose month navigation, workspace actions, and logout', async () => {
    const onMonthChange = vi.fn<(month: string) => void>()
    appMocks.signOutLocally.mockResolvedValue(undefined)
    render(
      <AuthenticatedAppPage
        month="2026-08"
        onMonthChange={onMonthChange}
        userId="user-a"
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Agosto de 2026' }),
    ).toBeVisible()
    const addButton = screen.getByRole('button', { name: 'Adicionar' })
    expect(addButton).toHaveAttribute('aria-disabled', 'true')
    addButton.focus()
    expect(addButton).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Mês anterior' }))
    expect(onMonthChange).toHaveBeenCalledWith('2026-07')

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))
    expect(
      await screen.findByRole('button', { name: 'Saindo...' }),
    ).toBeDisabled()
    expect(appMocks.signOutLocally).toHaveBeenCalledOnce()
  })

  it('should show safe copy when logout fails', async () => {
    appMocks.signOutLocally.mockRejectedValue(
      new Error('Provider detail must stay hidden'),
    )
    render(
      <AuthenticatedAppPage
        month="2026-08"
        onMonthChange={() => undefined}
        userId="user-a"
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Sair' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Não foi possível sair. Tente novamente.',
    )
    expect(screen.queryByText(/Provider detail/)).not.toBeInTheDocument()
  })
})
