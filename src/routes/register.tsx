import { createFileRoute, redirect } from '@tanstack/react-router'

import { RegisterPage } from '../features/auth/register-page'

export const Route = createFileRoute('/register')({
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'authenticated') {
      throw redirect({
        replace: true,
        to: context.auth.isPasswordRecovery ? '/auth/update-password' : '/app',
      })
    }
  },
  component: RegisterPage,
})
