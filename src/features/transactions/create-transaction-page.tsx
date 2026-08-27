import { useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useRef, useState } from 'react'

import {
  getDefaultTransactionDate,
  getTransactionMonth,
} from './transaction-calendar'
import { getTransactionErrorCopy } from './transaction-errors'
import { TransactionForm } from './transaction-form'
import { serializeTransactionPayload } from './transaction-form-schema'
import type { TransactionPayload } from './transaction-form-schema'
import { useCreateTransaction } from './transaction-mutations'
import type { TransactionMonth } from './transaction-types'

type CreateTransactionPageProps = {
  month: TransactionMonth
  userId: string
}

type Submission = {
  id: string
  payload: string
}

export function CreateTransactionPage({
  month,
  userId,
}: CreateTransactionPageProps) {
  const navigate = useNavigate()
  const createTransaction = useCreateTransaction(userId)
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [savedMonth, setSavedMonth] = useState<TransactionMonth | null>(null)
  const submission = useRef<Submission | null>(null)

  const initialValues = useMemo(
    () => ({
      amountDigits: '',
      date: getDefaultTransactionDate(month),
      description: '',
      kind: 'expense' as const,
    }),
    [month],
  )

  // Navigating from an effect lets the form re-render with isSaved before the
  // router asks whether the draft blocks the transition.
  useEffect(() => {
    if (!savedMonth) return

    void navigate({ replace: true, search: { month: savedMonth }, to: '/app' })
  }, [navigate, savedMonth])

  async function handleSubmit(payload: TransactionPayload) {
    const serialized = serializeTransactionPayload(payload)

    // The same normalized payload keeps its UUID so an ambiguous retry stays
    // idempotent; any edit mints a new one. See the plan's "RPC contract".
    const current =
      submission.current?.payload === serialized
        ? submission.current
        : { id: crypto.randomUUID(), payload: serialized }

    submission.current = current
    setErrorCopy(null)

    try {
      const transaction = await createTransaction.mutateAsync({
        amountCents: payload.amount_cents,
        description: payload.description,
        id: current.id,
        kind: payload.kind,
        transactionDate: payload.transaction_date,
      })

      submission.current = null
      setSavedMonth(getTransactionMonth(transaction.transaction_date))
    } catch (error) {
      setErrorCopy(getTransactionErrorCopy(error))
    }
  }

  return (
    <TransactionForm
      confirmLabel="Lançar"
      errorCopy={errorCopy}
      initialValues={initialValues}
      isPending={createTransaction.isPending}
      isSaved={savedMonth !== null}
      onCancel={() => void navigate({ search: { month }, to: '/app' })}
      onSubmit={(payload) => void handleSubmit(payload)}
      pendingLabel="Lançando..."
      title="Novo lançamento"
    />
  )
}
