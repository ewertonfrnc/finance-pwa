import { fireEvent, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { describe, expect, it } from 'vitest'

import {
  UnsavedChangesProvider,
  useUnsavedChangesGuard,
} from './unsaved-changes'

function DirtySurface({ isDirty }: { isDirty: boolean }) {
  useUnsavedChangesGuard(isDirty)
  return null
}

function ToggleableDirtySurface() {
  const [mounted, setMounted] = useState(true)

  return (
    <div>
      <button onClick={() => setMounted(false)} type="button">
        Fechar formulário
      </button>
      {mounted ? <DirtySurface isDirty /> : null}
    </div>
  )
}

function dispatchBeforeUnload() {
  const event = new Event('beforeunload', { cancelable: true })
  window.dispatchEvent(event)
  return event
}

describe('UnsavedChangesProvider', () => {
  it('should cancel the browser unload while a surface is dirty', () => {
    render(
      <UnsavedChangesProvider>
        <DirtySurface isDirty />
      </UnsavedChangesProvider>,
    )

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)
  })

  it('should not cancel the browser unload without any dirty surface', () => {
    render(
      <UnsavedChangesProvider>
        <DirtySurface isDirty={false} />
      </UnsavedChangesProvider>,
    )

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
  })

  it('should clear the dirty state when the dirty surface unmounts', () => {
    render(
      <UnsavedChangesProvider>
        <ToggleableDirtySurface />
      </UnsavedChangesProvider>,
    )

    expect(dispatchBeforeUnload().defaultPrevented).toBe(true)

    fireEvent.click(screen.getByRole('button', { name: 'Fechar formulário' }))

    expect(dispatchBeforeUnload().defaultPrevented).toBe(false)
  })
})
