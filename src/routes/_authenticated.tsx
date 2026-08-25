import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context, location }) => {
    if (context.auth.status !== 'authenticated') {
      throw redirect({
        replace: true,
        search: { redirect: location.href },
        to: '/login',
      })
    }

    if (context.auth.isPasswordRecovery) {
      throw redirect({ replace: true, to: '/auth/update-password' })
    }

    return { session: context.auth.session }
  },
})
