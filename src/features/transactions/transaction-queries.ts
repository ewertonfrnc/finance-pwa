import { queryOptions } from '@tanstack/react-query'

import { readMonthlyTransactions, readTransaction } from './transaction-service'
import type { TransactionMonth } from './transaction-types'

export const transactionQueryKeys = {
  all: ['transactions'] as const,
  detail: (userId: string, transactionId: string) =>
    ['transactions', userId, 'detail', transactionId] as const,
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

export function transactionDetailQueryOptions(
  userId: string,
  transactionId: string,
) {
  return queryOptions({
    queryFn: ({ signal }) => readTransaction({ id: transactionId, signal }),
    queryKey: transactionQueryKeys.detail(userId, transactionId),
  })
}
