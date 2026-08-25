import type { Session } from '@supabase/supabase-js'
import { useQueryClient } from '@tanstack/react-query'
import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'

import { observeAuthState } from './auth-service'

const PASSWORD_RECOVERY_USER_ID_KEY = 'finance-pwa:password-recovery-user-id'

function readPasswordRecoveryUserId() {
  try {
    return window.localStorage.getItem(PASSWORD_RECOVERY_USER_ID_KEY)
  } catch {
    return null
  }
}

function storePasswordRecoveryUserId(userId: string | null) {
  try {
    if (userId) {
      window.localStorage.setItem(PASSWORD_RECOVERY_USER_ID_KEY, userId)
    } else {
      window.localStorage.removeItem(PASSWORD_RECOVERY_USER_ID_KEY)
    }
  } catch {
    // The current page still retains recovery mode when browser storage is unavailable.
  }
}

type ResolvingAuthSession = {
  session: null
  status: 'resolving'
}

type AnonymousAuthSession = {
  session: null
  status: 'anonymous'
}

type AuthenticatedAuthSession = {
  isPasswordRecovery: boolean
  session: Session
  status: 'authenticated'
}

export type AuthSessionState =
  ResolvingAuthSession | AnonymousAuthSession | AuthenticatedAuthSession

export type ResolvedAuthSession = Exclude<
  AuthSessionState,
  ResolvingAuthSession
>

const AuthSessionContext = createContext<AuthSessionState | null>(null)

type AuthSessionProviderProps = {
  children: ReactNode
}

export function AuthSessionProvider({ children }: AuthSessionProviderProps) {
  const queryClient = useQueryClient()
  const passwordRecoveryUserId = useRef<string | null | undefined>(undefined)
  const previousUserId = useRef<string | null | undefined>(undefined)
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    status: 'resolving',
  })

  if (passwordRecoveryUserId.current === undefined) {
    passwordRecoveryUserId.current = readPasswordRecoveryUserId()
  }

  useEffect(() => {
    return observeAuthState((event, session) => {
      const nextUserId = session?.user.id ?? null

      if (
        previousUserId.current !== undefined &&
        previousUserId.current !== nextUserId
      ) {
        queryClient.clear()
      }

      previousUserId.current = nextUserId

      if (!session) {
        passwordRecoveryUserId.current = null
        storePasswordRecoveryUserId(null)
        setState({ session: null, status: 'anonymous' })
        return
      }

      const isPasswordRecovery =
        event === 'PASSWORD_RECOVERY' ||
        passwordRecoveryUserId.current === session.user.id

      passwordRecoveryUserId.current = isPasswordRecovery
        ? session.user.id
        : null
      storePasswordRecoveryUserId(passwordRecoveryUserId.current)
      setState({ isPasswordRecovery, session, status: 'authenticated' })
    })
  }, [queryClient])

  return (
    <AuthSessionContext.Provider value={state}>
      {children}
    </AuthSessionContext.Provider>
  )
}

export function useAuthSession() {
  const context = useContext(AuthSessionContext)

  if (!context) {
    throw new Error('useAuthSession must be used inside AuthSessionProvider')
  }

  return context
}
