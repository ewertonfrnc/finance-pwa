import { createFileRoute, redirect } from '@tanstack/react-router'

import { StartingPositionDetailPage } from '../features/starting-position/starting-position-detail-page'
import {
  getLocalCurrentMonth,
  isTransactionMonth,
} from '../features/transactions/transaction-calendar'

export const Route = createFileRoute(
  '/_authenticated/_positioned/app_/starting-position',
)({
  beforeLoad: ({ search }) => {
    if (!search.month) {
      throw redirect({
        replace: true,
        search: {
          ...search,
          month: getLocalCurrentMonth(),
        },
        to: '/app/starting-position',
      })
    }
  },
  component: StartingPositionRoute,
  validateSearch: (
    search: Record<string, unknown>,
  ): { month?: string; notice?: string } => ({
    month: isTransactionMonth(search.month) ? search.month : undefined,
    notice: search.notice === 'already-saved' ? 'already-saved' : undefined,
  }),
})

function StartingPositionRoute() {
  const { month, notice } = Route.useSearch()
  const { session } = Route.useRouteContext()
  const backMonth = month ?? getLocalCurrentMonth()

  return (
    <StartingPositionDetailPage
      backMonth={backMonth}
      notice={notice}
      userId={session.user.id}
    />
  )
}
