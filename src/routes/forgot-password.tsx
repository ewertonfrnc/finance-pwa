import { createFileRoute, redirect } from '@tanstack/react-router'

import { ForgotPasswordPage } from '../features/auth/forgot-password-page'

export const Route = createFileRoute('/forgot-password')({
  beforeLoad: ({ context }) => {
    if (context.auth.status === 'authenticated') {
      throw redirect({
        replace: true,
        to: context.auth.isPasswordRecovery ? '/auth/update-password' : '/app',
      })
    }
  },
  component: ForgotPasswordPage,
})
