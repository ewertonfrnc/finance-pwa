import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getTransactionMonth } from './transaction-calendar'
import { transactionQueryKeys } from './transaction-queries'
import { createTransaction, updateTransaction } from './transaction-service'
import type { UpdateTransactionInput } from './transaction-service'
import type { TransactionMonth } from './transaction-types'

export function useCreateTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createTransaction,
    onSuccess: async (transaction) => {
      // Invalidate the month the server actually persisted the row under,
      // not the month the client requested, since the two can differ.
      const month = getTransactionMonth(transaction.transaction_date)

      // refetchType 'all' because the workspace list is unmounted while the
      // form is open. The default only refetches active queries, so awaiting
      // it would return before the destination month had fresh data.
      await queryClient.invalidateQueries({
        queryKey: transactionQueryKeys.month(userId, month),
        refetchType: 'all',
      })
    },
  })
}

export type UpdateTransactionVariables = UpdateTransactionInput & {
  originalMonth: TransactionMonth
}

export function useUpdateTransaction(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    // updateTransaction reads named fields, so the extra originalMonth the
    // cache needs never reaches the RPC arguments.
    mutationFn: (variables: UpdateTransactionVariables) =>
      updateTransaction(variables),
    onSuccess: async (transaction, variables) => {
      const persistedMonth = getTransactionMonth(transaction.transaction_date)

      // The RPC returns the authoritative row, including the new version, so
      // writing it is exact. Invalidating would only refetch a detail the user
      // is leaving, and would race the navigation away from the form.
      queryClient.setQueryData(
        transactionQueryKeys.detail(userId, transaction.id),
        transaction,
      )

      // A moved row leaves one month and joins another, so both lose their
      // cached truth. An unchanged date collapses to a single invalidation.
      const months = new Set([variables.originalMonth, persistedMonth])

      await Promise.all(
        [...months].map((month) =>
          queryClient.invalidateQueries({
            queryKey: transactionQueryKeys.month(userId, month),
            refetchType: 'all',
          }),
        ),
      )
    },
  })
}
