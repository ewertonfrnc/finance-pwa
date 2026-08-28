import { useState } from 'react'

import { getStartingPositionErrorCopy } from './starting-position-errors'
import { StartingPositionForm } from './starting-position-form'
import { useInitializeStartingPosition } from './starting-position-mutations'
import type { StartingPositionPayload } from './starting-position-schema'

type StartingPositionPageProps = {
  onComplete: () => void
  onLogout: () => void
  userId: string
}

export function StartingPositionPage({
  onComplete,
  onLogout,
  userId,
}: StartingPositionPageProps) {
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const mutation = useInitializeStartingPosition(userId)

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
