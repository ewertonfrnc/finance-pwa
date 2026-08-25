import {
  formatTransactionDate,
  groupTransactionsByDate,
} from './transaction-calendar'
import { formatAmountCents } from './transaction-money'
import type { Transaction, TransactionKind } from './transaction-types'

type TransactionListProps = {
  transactions: readonly Transaction[]
}

const kindCopy: Record<TransactionKind, string> = {
  expense: 'Saída',
  income: 'Entrada',
}

export function TransactionList({ transactions }: TransactionListProps) {
  const groups = groupTransactionsByDate(transactions)

  return (
    <ol aria-label="Lançamentos do mês" className="space-y-5">
      {groups.map((group) => (
        <li key={group.date}>
          <h3 className="px-1 pb-2 text-xs font-semibold uppercase tracking-[0.11em] text-muted">
            <time dateTime={group.date}>
              {formatTransactionDate(group.date)}
            </time>
          </h3>

          <ul className="overflow-hidden rounded-3xl border border-line bg-panel shadow-(--finance-shadow-subtle)">
            {group.transactions.map((transaction) => (
              <li
                className="flex min-h-18 items-center gap-3 border-b border-line/80 px-4 py-3 last:border-b-0 sm:px-5"
                key={transaction.id}
              >
                <TransactionKindIcon kind={transaction.kind} />

                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">
                    {transaction.description ??
                      `${kindCopy[transaction.kind]} sem descrição`}
                  </p>
                  <p className="mt-0.5 text-sm text-muted">
                    {kindCopy[transaction.kind]}
                  </p>
                </div>

                <p
                  className={`shrink-0 text-right font-mono font-semibold tabular-nums ${
                    transaction.kind === 'income'
                      ? 'text-income-ink'
                      : 'text-expense-ink'
                  }`}
                >
                  <span aria-hidden="true">
                    {transaction.kind === 'income' ? '+' : '−'}{' '}
                  </span>
                  {formatAmountCents(transaction.amount_cents)}
                </p>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

function TransactionKindIcon({ kind }: { kind: TransactionKind }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
        kind === 'income'
          ? 'bg-income-soft text-income'
          : 'bg-expense-soft text-expense'
      }`}
    >
      <svg className="size-5" fill="none" viewBox="0 0 24 24">
        <path
          d={
            kind === 'income'
              ? 'M12 19V5m0 0L7 10m5-5 5 5'
              : 'M12 5v14m0 0 5-5m-5 5-5-5'
          }
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  )
}
