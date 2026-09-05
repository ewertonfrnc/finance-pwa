import { queryOptions } from '@tanstack/react-query'

import { readDailySpendingSetting } from './daily-spending-service'

export const dailySpendingQueryKeys = {
  all: ['daily-spending'] as const,
  byUser: (userId: string) => ['daily-spending', userId] as const,
}

export function dailySpendingQueryOptions(userId: string) {
  return queryOptions({
    queryFn: ({ signal }) => readDailySpendingSetting({ signal }),
    queryKey: dailySpendingQueryKeys.byUser(userId),
    // Unlike the immutable starting position, this row is mutable: the user
    // can edit their daily target from another tab or device. Keep the
    // default staleTime so a stale cached value does not linger here.
  })
}
