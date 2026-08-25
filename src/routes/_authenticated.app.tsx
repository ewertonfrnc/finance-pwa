import { createFileRoute, redirect } from '@tanstack/react-router'

import { AuthenticatedAppPage } from '../app/authenticated-app-page'
import {
  getLocalCurrentMonth,
  isTransactionMonth,
} from '../features/transactions/transaction-calendar'

export const Route = createFileRoute('/_authenticated/app')({
  beforeLoad: ({ search }) => {
    if (!search.month) {
      throw redirect({
        replace: true,
        search: { month: getLocalCurrentMonth() },
        to: '/app',
      })
    }

    return { selectedMonth: search.month }
  },
  component: AuthenticatedAppRoute,
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: isTransactionMonth(search.month) ? search.month : undefined,
  }),
})

function AuthenticatedAppRoute() {
  const { selectedMonth, session } = Route.useRouteContext()
  const navigate = Route.useNavigate()

  return (
    <AuthenticatedAppPage
      email={session.user.email ?? 'Email não disponível'}
      month={selectedMonth}
      onMonthChange={(month) =>
        void navigate({ search: { month }, to: '/app' })
      }
      userId={session.user.id}
    />
  )
}
