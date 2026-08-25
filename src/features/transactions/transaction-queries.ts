import { queryOptions } from '@tanstack/react-query'

import { readMonthlyTransactions } from './transaction-service'
import type { TransactionMonth } from './transaction-types'

export const transactionQueryKeys = {
  all: ['transactions'] as const,
  month: (userId: string, month: TransactionMonth) =>
    ['transactions', userId, 'month', month] as const,
}

export function monthlyTransactionsQueryOptions(
  userId: string,
  month: TransactionMonth,
) {
  return queryOptions({
    queryFn: ({ signal }) => readMonthlyTransactions({ month, signal }),
    queryKey: transactionQueryKeys.month(userId, month),
  })
}
