import { queryOptions } from '@tanstack/react-query'

import { readStartingPosition } from './starting-position-service'

export const startingPositionQueryKeys = {
  all: ['starting-position'] as const,
  byUser: (userId: string) => ['starting-position', userId] as const,
}

export function startingPositionQueryOptions(userId: string) {
  return queryOptions({
    queryFn: ({ signal }) => readStartingPosition({ signal }),
    queryKey: startingPositionQueryKeys.byUser(userId),
    // A saved row never changes in this step, so it can stay fresh forever.
    // `null` must be revalidated on the next navigation so another tab's
    // successful insert is not missed.
    staleTime: (query) => (query.state.data ? ('static' as const) : 0),
  })
}
