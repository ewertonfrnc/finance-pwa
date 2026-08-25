import { useQuery } from '@tanstack/react-query'

import { useNetworkStatus } from '../../lib/use-network-status'
import { monthlyTransactionsQueryOptions } from './transaction-queries'
import type { TransactionMonth } from './transaction-types'
import { TransactionList } from './transaction-list'

type TransactionsPageProps = {
  month: TransactionMonth
  userId: string
}

export function TransactionsPage({ month, userId }: TransactionsPageProps) {
  const isOnline = useNetworkStatus()
  const query = useQuery({
    ...monthlyTransactionsQueryOptions(userId, month),
    enabled: isOnline,
  })

  return (
    <section
      aria-labelledby="transaction-history-title"
      className="mx-auto w-full max-w-3xl px-4 pt-[calc(env(safe-area-inset-top)+5.5rem)] pb-[calc(env(safe-area-inset-bottom)+5.5rem)] sm:px-6"
      id="transaction-history"
    >
      <div className="px-1">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-accent-ink">
          Histórico mensal
        </p>
        <h2
          className="mt-1 text-2xl font-semibold tracking-[-0.035em] text-ink sm:text-3xl"
          id="transaction-history-title"
        >
          Lançamentos
        </h2>
      </div>

      <div className="relative mt-5">
        {!isOnline ? <OfflineState /> : null}
        {isOnline && query.isPending ? <LoadingState /> : null}
        {isOnline && query.isError ? (
          <ErrorState onRetry={() => void query.refetch()} />
        ) : null}
        {isOnline && query.isSuccess && query.data.length === 0 ? (
          <EmptyState />
        ) : null}
        {isOnline && query.isSuccess && query.data.length > 0 ? (
          <TransactionList transactions={query.data} />
        ) : null}

        {isOnline && query.isSuccess && query.isFetching ? (
          <output className="absolute -top-9 right-1 text-xs font-medium text-muted">
            Atualizando...
          </output>
        ) : null}
      </div>
    </section>
  )
}

function LoadingState() {
  return (
    <output aria-label="Carregando lançamentos" className="block space-y-3">
      <span className="block h-4 w-40 animate-pulse rounded-full bg-subtle" />
      <span className="block h-20 animate-pulse rounded-3xl bg-panel" />
      <span className="block h-20 animate-pulse rounded-3xl bg-panel" />
    </output>
  )
}

function EmptyState() {
  return (
    <section className="rounded-4xl border border-line bg-panel px-6 py-12 text-center shadow-(--finance-shadow-subtle) sm:px-10">
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-3xl bg-accent-soft text-accent-ink"
      >
        <ReceiptIcon />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-ink">
        Nenhum lançamento neste mês.
      </h3>
      <p className="mx-auto mt-2 max-w-sm leading-7 text-muted">
        Entradas e saídas vão aparecer aqui, organizadas pela data em que
        aconteceram.
      </p>
      <p className="mt-5 text-sm font-medium text-muted">
        O cadastro será liberado na próxima etapa.
      </p>
    </section>
  )
}

function OfflineState() {
  return (
    <section className="rounded-4xl border border-warning/70 bg-panel px-6 py-10 text-center shadow-(--finance-shadow-subtle) sm:px-10">
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-3xl bg-warning/30 text-ink"
      >
        <OfflineIcon />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-ink">
        Conecte-se para ver seus lançamentos.
      </h3>
      <p className="mx-auto mt-2 max-w-sm leading-7 text-muted">
        O histórico financeiro não fica disponível offline para evitar mostrar
        dados desatualizados.
      </p>
    </section>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <section
      className="rounded-4xl border border-expense/40 bg-panel px-6 py-10 text-center shadow-(--finance-shadow-subtle) sm:px-10"
      role="alert"
    >
      <span
        aria-hidden="true"
        className="mx-auto grid size-14 place-items-center rounded-3xl bg-expense-soft text-expense"
      >
        <AlertIcon />
      </span>
      <h3 className="mt-5 text-xl font-semibold text-ink">
        Não foi possível carregar o mês.
      </h3>
      <p className="mx-auto mt-2 max-w-sm leading-7 text-muted">
        Confira sua conexão e tente novamente. Seus dados não foram alterados.
      </p>
      <button
        className="mt-6 min-h-11 rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        onClick={onRetry}
        type="button"
      >
        Tentar novamente
      </button>
    </section>
  )
}

function ReceiptIcon() {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 4h10a1 1 0 0 1 1 1v15l-3-2-3 2-3-2-3 2V5a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M9 9h6M9 13h4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function OfflineIcon() {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M8.5 8.5A8.8 8.8 0 0 1 20 10m-2.5 3a6.4 6.4 0 0 0-5.8-1.8M4 4l16 16M8.5 16.5A5 5 0 0 1 12 15c1.1 0 2.1.35 3 .95M12 20h.01M4 10a9 9 0 0 1 1.6-2.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" className="size-6" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 8v5m0 3.5h.01M10.3 4.8 3.6 17a2 2 0 0 0 1.75 3h13.3a2 2 0 0 0 1.75-3L13.7 4.8a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
