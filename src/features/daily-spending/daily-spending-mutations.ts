import { useMutation, useQueryClient } from '@tanstack/react-query'

import { dailySpendingQueryKeys } from './daily-spending-queries'
import { setDailySpending } from './daily-spending-service'

export function useSetDailySpending(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: setDailySpending,
    onSuccess: (data) => {
      // The RPC returns the authoritative row, so write it exactly. Balance
      // query invalidation is added in a later step once those query keys
      // exist.
      queryClient.setQueryData(dailySpendingQueryKeys.byUser(userId), data)
    },
  })
}
