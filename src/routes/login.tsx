import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { LoginPage } from '../features/auth/login-page'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'authenticated') {
      throw redirect({ replace: true, to: '/app' })
    }
  },
  component: LoginRoute,
  validateSearch: (search: Record<string, unknown>) => ({
    redirect: typeof search.redirect === 'string' ? search.redirect : undefined,
  }),
})

function LoginRoute() {
  const { redirect: requestedDestination } = Route.useSearch()
  const router = useRouter()

  return (
    <LoginPage
      onSignedIn={async (destination) => {
        await router.invalidate()
        await router.navigate({ href: destination, replace: true })
      }}
      redirect={requestedDestination}
    />
  )
}
