import { createFileRoute } from '@tanstack/react-router'

import { EditTransactionPage } from '../features/transactions/edit-transaction-page'
import { isTransactionMonth } from '../features/transactions/transaction-calendar'

export const Route = createFileRoute(
  '/_authenticated/_positioned/app_/transactions/$transactionId/edit',
)({
  component: EditTransactionRoute,
  validateSearch: (search: Record<string, unknown>): { month?: string } => ({
    month: isTransactionMonth(search.month) ? search.month : undefined,
  }),
})

function EditTransactionRoute() {
  const { transactionId } = Route.useParams()
  const { month } = Route.useSearch()
  const { session } = Route.useRouteContext()

  // An absent month is not an error here. The page falls back to the month of
  // the row it loads, which is where the user expects to return.
  return (
    <EditTransactionPage
      month={month}
      transactionId={transactionId}
      userId={session.user.id}
    />
  )
}
