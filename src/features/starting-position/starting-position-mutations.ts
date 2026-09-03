import { useMutation, useQueryClient } from '@tanstack/react-query'

import { startingPositionQueryKeys } from './starting-position-queries'
import { initializeStartingPosition } from './starting-position-service'

export function useInitializeStartingPosition(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: initializeStartingPosition,
    onSuccess: (data) => {
      // The RPC returns the authoritative row, so write it exactly. Do not
      // refetch a row the server just returned and do not invalidate
      // transaction months — the opening position is not a transaction.
      queryClient.setQueryData(startingPositionQueryKeys.byUser(userId), data)
    },
  })
}
