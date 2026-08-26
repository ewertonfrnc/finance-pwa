import { createFileRoute } from '@tanstack/react-router'

import { CreateTransactionPage } from '../features/transactions/create-transaction-page'
import {
  getLocalCurrentMonth,
  isTransactionMonth,
} from '../features/transactions/transaction-calendar'

export const Route = createFileRoute('/_authenticated/app_/transactions/new')({
  component: CreateTransactionRoute,
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: isTransactionMonth(search.month) ? search.month : undefined,
  }),
})

function CreateTransactionRoute() {
  const { month } = Route.useSearch()
  const { session } = Route.useRouteContext()

  // An absent or invalid month falls back in place. Redirecting to /app the
  // way the workspace route does would push the user out of the form.
  return (
    <CreateTransactionPage
      month={month ?? getLocalCurrentMonth()}
      userId={session.user.id}
    />
  )
}
