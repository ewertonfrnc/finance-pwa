import { QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { AuthSessionProvider } from '../features/auth/auth-session'
import { queryClient } from './query-client'
import { UnsavedChangesProvider } from './unsaved-changes'

type AppProvidersProps = {
  children: ReactNode
}

export function AppProviders({ children }: AppProvidersProps) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthSessionProvider>
        <UnsavedChangesProvider>{children}</UnsavedChangesProvider>
      </AuthSessionProvider>
    </QueryClientProvider>
  )
}
