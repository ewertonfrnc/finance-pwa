import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

import {
  getStartingPositionErrorCopy,
  isStartingPositionAlreadyExists,
} from './starting-position-errors'
import { StartingPositionForm } from './starting-position-form'
import { startingPositionQueryOptions } from './starting-position-queries'
import { useInitializeStartingPosition } from './starting-position-mutations'
import type { StartingPositionPayload } from './starting-position-schema'

type StartingPositionPageProps = {
  onAlreadySaved?: () => void | Promise<void>
  onComplete: () => void
  onLogout: () => void
  userId: string
}

export function StartingPositionPage({
  onAlreadySaved,
  onComplete,
  onLogout,
  userId,
}: StartingPositionPageProps) {
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const mutation = useInitializeStartingPosition(userId)
  const queryClient = useQueryClient()

  async function handleSubmit(payload: StartingPositionPayload) {
    setErrorCopy(null)

    try {
      await mutation.mutateAsync({
        balanceCents: payload.balance_cents,
        effectiveOn: payload.effective_on,
      })
      setErrorCopy(null)
      onComplete()
    } catch (error) {
      if (isStartingPositionAlreadyExists(error)) {
        try {
          const authoritative = await queryClient.fetchQuery(
            startingPositionQueryOptions(userId),
          )
          if (authoritative && onAlreadySaved) {
            await onAlreadySaved()
            return
          }
        } catch {
          // Fall through to safe copy below.
        }
      }
      setErrorCopy(getStartingPositionErrorCopy(error))
    }
  }

  return (
    <StartingPositionForm
      errorCopy={errorCopy}
      isPending={mutation.isPending}
      onLogout={onLogout}
      onSubmit={(payload) => void handleSubmit(payload)}
    />
  )
}
