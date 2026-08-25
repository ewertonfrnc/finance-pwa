import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { LoginPage } from '../features/auth/login-page'

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'authenticated') {
      throw redirect({
        replace: true,
        to: context.auth.isPasswordRecovery ? '/auth/update-password' : '/app',
      })
    }
  },
  component: LoginRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { notice?: 'password-updated'; redirect?: string } => {
    const result: { notice?: 'password-updated'; redirect?: string } = {}

    if (search.notice === 'password-updated') {
      result.notice = 'password-updated'
    }

    if (typeof search.redirect === 'string') {
      result.redirect = search.redirect
    }

    return result
  },
})

function LoginRoute() {
  const { notice, redirect: requestedDestination } = Route.useSearch()
  const router = useRouter()

  return (
    <LoginPage
      onSignedIn={async (destination) => {
        await router.invalidate()
        await router.navigate({ href: destination, replace: true })
      }}
      notice={notice}
      redirect={requestedDestination}
    />
  )
}
