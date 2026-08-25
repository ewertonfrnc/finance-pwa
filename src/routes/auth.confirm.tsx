import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useCallback } from 'react'

import { ConfirmPage } from '../features/auth/confirm-page'

export const Route = createFileRoute('/auth/confirm')({
  component: ConfirmRoute,
})

function ConfirmRoute() {
  const { auth } = Route.useRouteContext()
  const router = useRouter()
  const handleConfirmed = useCallback(
    () => router.navigate({ replace: true, to: '/app' }),
    [router],
  )

  return <ConfirmPage auth={auth} onConfirmed={handleConfirmed} />
}
