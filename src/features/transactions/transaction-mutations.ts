import { useMutation, useQueryClient } from '@tanstack/react-query'

import { getTransactionMonth } from './transaction-calendar'
import { transactionQueryKeys } from './transaction-queries'
import { createTransaction } from './transaction-service'

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
