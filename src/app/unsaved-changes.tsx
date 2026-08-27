import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

type UnsavedChangesContextValue = {
  hasUnsavedChanges: boolean
  registerDirtySurface: () => void
  unregisterDirtySurface: () => void
}

const UnsavedChangesContext = createContext<UnsavedChangesContextValue | null>(
  null,
)

type UnsavedChangesProviderProps = {
  children: ReactNode
}

export function UnsavedChangesProvider({
  children,
}: UnsavedChangesProviderProps) {
  const dirtySurfaceCount = useRef(0)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  const registerDirtySurface = useCallback(() => {
    dirtySurfaceCount.current += 1
    setHasUnsavedChanges(true)
  }, [])

  const unregisterDirtySurface = useCallback(() => {
    dirtySurfaceCount.current = Math.max(0, dirtySurfaceCount.current - 1)
    setHasUnsavedChanges(dirtySurfaceCount.current > 0)
  }, [])

  useEffect(() => {
    if (!hasUnsavedChanges) return

    function handleBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault()
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [hasUnsavedChanges])

  return (
    <UnsavedChangesContext.Provider
      value={{
        hasUnsavedChanges,
        registerDirtySurface,
        unregisterDirtySurface,
      }}
    >
      {children}
    </UnsavedChangesContext.Provider>
  )
}

function useUnsavedChangesContext() {
  const context = useContext(UnsavedChangesContext)

  if (!context) {
    throw new Error(
      'useUnsavedChanges must be used within an UnsavedChangesProvider',
    )
  }

  return context
}

export function useUnsavedChanges() {
  const { hasUnsavedChanges } = useUnsavedChangesContext()
  return { hasUnsavedChanges }
}

// The transaction form calls this with its dirty state; the PWA update
// prompt reads the aggregate through useUnsavedChanges().
export function useUnsavedChangesGuard(isDirty: boolean) {
  const { registerDirtySurface, unregisterDirtySurface } =
    useUnsavedChangesContext()

  useEffect(() => {
    if (!isDirty) return

    registerDirtySurface()
    return unregisterDirtySurface
  }, [isDirty, registerDirtySurface, unregisterDirtySurface])
}
