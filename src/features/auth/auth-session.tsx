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
  const previousUserId = useRef<string | null | undefined>(undefined)
  const [state, setState] = useState<AuthSessionState>({
    session: null,
    status: 'resolving',
  })

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
      setState((currentState) => {
        if (!session) return { session: null, status: 'anonymous' }

        const sameRecoveryUser =
          currentState.status === 'authenticated' &&
          currentState.isPasswordRecovery &&
          currentState.session.user.id === session.user.id

        return {
          isPasswordRecovery: event === 'PASSWORD_RECOVERY' || sameRecoveryUser,
          session,
          status: 'authenticated',
        }
      })
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
