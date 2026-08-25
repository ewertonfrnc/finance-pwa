import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { UpdatePasswordPage } from '../features/auth/update-password-page'

export const Route = createFileRoute('/auth/update-password')({
  component: UpdatePasswordRoute,
})

function UpdatePasswordRoute() {
  const { auth } = Route.useRouteContext()
  const router = useRouter()
  const handlePasswordUpdated = useCallback(
    () =>
      router.navigate({
        replace: true,
        search: { notice: 'password-updated' },
        to: '/login',
      }),
    [router],
  )

  return (
    <UpdatePasswordPage auth={auth} onPasswordUpdated={handlePasswordUpdated} />
  )
}
