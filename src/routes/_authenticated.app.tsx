import { createFileRoute } from '@tanstack/react-router'

import { AuthenticatedHomePage } from '../features/auth/authenticated-home-page'

export const Route = createFileRoute('/_authenticated/app')({
  component: AuthenticatedAppRoute,
})

function AuthenticatedAppRoute() {
  const { session } = Route.useRouteContext()

  return (
    <AuthenticatedHomePage
      email={session.user.email ?? 'Email não disponível'}
    />
  )
}
