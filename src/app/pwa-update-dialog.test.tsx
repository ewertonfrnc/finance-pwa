import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { PwaUpdateDialog } from './pwa-update-dialog'

describe('PwaUpdateDialog', () => {
  it('should update only after the user confirms the reload', () => {
    const onAccept = vi.fn<() => void>()
    const onDismiss = vi.fn<() => void>()

    render(
      <PwaUpdateDialog
        hasUnsavedChanges={false}
        kind="update"
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    )

    expect(
      screen.getByRole('heading', { name: 'Nova versão disponível' }),
    ).toBeVisible()
    expect(onAccept).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Atualizar agora' }))

    expect(onAccept).toHaveBeenCalledOnce()
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('should keep the current version when the user postpones the update', () => {
    const onAccept = vi.fn<() => void>()
    const onDismiss = vi.fn<() => void>()

    render(
      <PwaUpdateDialog
        hasUnsavedChanges={false}
        kind="update"
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('should never offer a path that reloads over an unsaved draft', () => {
    const onAccept = vi.fn<() => void>()
    const onDismiss = vi.fn<() => void>()

    render(
      <PwaUpdateDialog
        hasUnsavedChanges
        kind="update"
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    )

    expect(
      screen.getByText(
        'Salve ou descarte o rascunho do lançamento antes de atualizar.',
      ),
    ).toBeVisible()
    expect(
      screen.queryByRole('button', { name: 'Atualizar agora' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Depois' }))

    expect(onDismiss).toHaveBeenCalledOnce()
    expect(onAccept).not.toHaveBeenCalled()
  })

  it('should keep the offline-ready dialog unaffected by unsaved changes', () => {
    const onAccept = vi.fn<() => void>()
    const onDismiss = vi.fn<() => void>()

    render(
      <PwaUpdateDialog
        hasUnsavedChanges={false}
        kind="offline-ready"
        onAccept={onAccept}
        onDismiss={onDismiss}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Entendi' }))

    expect(onAccept).toHaveBeenCalledOnce()
  })
})
