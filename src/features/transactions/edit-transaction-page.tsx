import { useQuery } from '@tanstack/react-query'
import { Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'

import { useNetworkStatus } from '../../lib/use-network-status'
import {
  getLocalCurrentMonth,
  getTransactionMonth,
} from './transaction-calendar'
import {
  getTransactionErrorCopy,
  isTransactionConflict,
} from './transaction-errors'
import { TransactionForm } from './transaction-form'
import type { TransactionPayload } from './transaction-form-schema'
import { toCentavoDigits } from './transaction-money'
import { useUpdateTransaction } from './transaction-mutations'
import { transactionDetailQueryOptions } from './transaction-queries'
import type { Transaction, TransactionMonth } from './transaction-types'

const CONFLICT_ACTION_LABEL = 'Recarregar lançamento'

// The conflict alert has to say what recovery costs, because reloading the
// server row is what replaces the fields the user just typed.
const CONFLICT_RECOVERY_HINT =
  'Recarregar substitui o que você editou pelos dados salvos.'

type EditTransactionPageProps = {
  month?: TransactionMonth
  transactionId: string
  userId: string
}

export function EditTransactionPage({
  month,
  transactionId,
  userId,
}: EditTransactionPageProps) {
  const navigate = useNavigate()
  const isOnline = useNetworkStatus()
  const query = useQuery({
    ...transactionDetailQueryOptions(userId, transactionId),
    enabled: isOnline,
  })
  const updateTransaction = useUpdateTransaction(userId)
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [hasConflict, setHasConflict] = useState(false)
  const [savedMonth, setSavedMonth] = useState<TransactionMonth | null>(null)

  const transaction = query.data ?? null

  // Opening the route directly carries no browsed month, so the row's own
  // month is the honest place to return to.
  const returnMonth =
    month ??
    (transaction
      ? getTransactionMonth(transaction.transaction_date)
      : getLocalCurrentMonth())

  const initialValues = useMemo(
    () =>
      transaction
        ? {
            amountDigits: toCentavoDigits(transaction.amount_cents),
            date: transaction.transaction_date,
            description: transaction.description ?? '',
            kind: transaction.kind,
          }
        : null,
    [transaction],
  )

  // Navigating from an effect lets the form re-render with isSaved before the
  // router asks whether the draft blocks the transition.
  useEffect(() => {
    if (!savedMonth) return

    void navigate({ replace: true, search: { month: savedMonth }, to: '/app' })
  }, [navigate, savedMonth])

  async function handleSubmit(
    payload: TransactionPayload,
    current: Transaction,
  ) {
    setErrorCopy(null)
    setHasConflict(false)

    try {
      const persisted = await updateTransaction.mutateAsync({
        amountCents: payload.amount_cents,
        description: payload.description,
        expectedUpdatedAt: current.updated_at,
        id: current.id,
        kind: payload.kind,
        originalMonth: getTransactionMonth(current.transaction_date),
        transactionDate: payload.transaction_date,
      })

      setSavedMonth(getTransactionMonth(persisted.transaction_date))
    } catch (error) {
      const conflict = isTransactionConflict(error)

      setHasConflict(conflict)
      setErrorCopy(
        conflict
          ? `${getTransactionErrorCopy(error)} ${CONFLICT_RECOVERY_HINT}`
          : getTransactionErrorCopy(error),
      )
    }
  }

  async function handleConflictReload() {
    setErrorCopy(null)

    const result = await query.refetch()

    if (result.isError) {
      setErrorCopy(getTransactionErrorCopy(result.error))
      return
    }

    setHasConflict(false)
  }

  if (!isOnline) {
    return (
      <TransactionNotice
        month={returnMonth}
        title="Conecte-se para editar este lançamento."
      >
        Editar exige conexão, para não salvar uma alteração sobre um valor
        desatualizado.
      </TransactionNotice>
    )
  }

  if (query.isPending) {
    return (
      <main
        className="finance-safe-top finance-safe-x min-h-svh bg-subtle"
        data-page-canvas="subtle"
      >
        <output
          aria-label="Carregando lançamento"
          className="mx-auto block w-full max-w-2xl space-y-5 px-4 pt-16 sm:px-6"
        >
          <span className="block h-24 animate-pulse rounded-3xl bg-panel" />
          <span className="block h-16 animate-pulse rounded-3xl bg-panel" />
          <span className="block h-40 animate-pulse rounded-3xl bg-panel" />
        </output>
      </main>
    )
  }

  if (query.isError) {
    return (
      <TransactionNotice
        month={returnMonth}
        onRetry={() => void query.refetch()}
        title="Não foi possível carregar o lançamento."
      >
        Confira sua conexão e tente novamente. Nada foi alterado.
      </TransactionNotice>
    )
  }

  if (!transaction || !initialValues) {
    return (
      <TransactionNotice month={returnMonth} title="Lançamento não encontrado.">
        Ele pode ter sido excluído ou nunca ter pertencido a esta conta.
      </TransactionNotice>
    )
  }

  return (
    <TransactionForm
      confirmLabel="Salvar"
      errorAction={
        hasConflict
          ? {
              label: CONFLICT_ACTION_LABEL,
              onAction: () => void handleConflictReload(),
            }
          : undefined
      }
      errorCopy={errorCopy}
      initialValues={initialValues}
      isPending={updateTransaction.isPending}
      isSaved={savedMonth !== null}
      // A reloaded row is a different starting point, so the fields and the
      // dirty comparison both restart from the version the server just sent.
      key={transaction.updated_at}
      onCancel={() =>
        void navigate({ search: { month: returnMonth }, to: '/app' })
      }
      onSubmit={(payload) => void handleSubmit(payload, transaction)}
      pendingLabel="Salvando..."
      title="Editar lançamento"
    />
  )
}

type TransactionNoticeProps = {
  children: React.ReactNode
  month: TransactionMonth
  onRetry?: () => void
  title: string
}

function TransactionNotice({
  children,
  month,
  onRetry,
  title,
}: TransactionNoticeProps) {
  return (
    <main
      className="finance-safe-top finance-safe-bottom finance-safe-x min-h-svh bg-subtle"
      data-page-canvas="subtle"
    >
      <div className="mx-auto w-full max-w-md px-4 pt-16 sm:px-6">
        <section
          className="rounded-4xl border border-line bg-panel px-6 py-10 text-center shadow-(--finance-shadow-subtle)"
          role={onRetry ? 'alert' : undefined}
        >
          <h1 className="text-xl font-semibold text-ink">{title}</h1>
          <p className="mx-auto mt-2 max-w-sm leading-7 text-muted">
            {children}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {onRetry ? (
              <button
                className="min-h-11 rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={onRetry}
                type="button"
              >
                Tentar novamente
              </button>
            ) : null}

            <Link
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              search={{ month }}
              to="/app"
            >
              Voltar para o mês
            </Link>
          </div>
        </section>
      </div>
    </main>
  )
}
