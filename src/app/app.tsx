import { useQueryClient } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import { useEffect } from 'react'

import { BrandMark } from '../components/brand-mark'
import { useAuthSession } from '../features/auth/auth-session'
import { AppProviders } from './providers'
import { router } from './router'

export function App() {
  return (
    <AppProviders>
      <ResolvedAppRouter />
    </AppProviders>
  )
}

function ResolvedAppRouter() {
  const auth = useAuthSession()
  const queryClient = useQueryClient()
  const authIdentity =
    auth.status === 'authenticated' ? auth.session.user.id : auth.status

  useEffect(() => {
    if (authIdentity !== 'resolving') void router.invalidate()
  }, [authIdentity])

  if (auth.status === 'resolving') return <SessionLoadingPage />

  return <RouterProvider context={{ auth, queryClient }} router={router} />
}

function SessionLoadingPage() {
  return (
    <main className="grid min-h-svh place-items-center px-5 py-12">
      <output className="flex flex-col items-center text-center">
        <BrandMark className="size-12 animate-pulse text-ink" />
        <p className="mt-5 font-semibold text-ink">Carregando sua sessão...</p>
      </output>
    </main>
  )
}
