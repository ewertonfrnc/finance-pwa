import { Link } from '@tanstack/react-router'

import {
  formatTransactionDate,
  groupTransactionsByDate,
} from './transaction-calendar'
import { formatAmountCents } from './transaction-money'
import { TRANSACTION_KIND_META, TransactionKindBadge } from './transaction-kind'
import type { Transaction, TransactionMonth } from './transaction-types'

type TransactionListProps = {
  month: TransactionMonth
  transactions: readonly Transaction[]
}

export function TransactionList({ month, transactions }: TransactionListProps) {
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
                className="border-b border-line/80 last:border-b-0"
                key={transaction.id}
              >
                <Link
                  className="flex min-h-18 items-center gap-3 px-4 py-3 transition hover:bg-subtle focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent sm:px-5"
                  params={{ transactionId: transaction.id }}
                  search={{ month }}
                  to="/app/transactions/$transactionId/edit"
                >
                  <TransactionKindBadge
                    className="size-10"
                    kind={transaction.kind}
                    markClassName="size-5"
                  />

                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium text-ink">
                      {transaction.description ??
                        `${TRANSACTION_KIND_META[transaction.kind].label} sem descrição`}
                    </p>
                    <p className="mt-0.5 text-sm text-muted">
                      {TRANSACTION_KIND_META[transaction.kind].label}
                    </p>
                  </div>

                  <p
                    className={`shrink-0 text-right font-mono font-semibold tabular-nums ${TRANSACTION_KIND_META[transaction.kind].amountClassName}`}
                  >
                    <span aria-hidden="true">
                      {TRANSACTION_KIND_META[transaction.kind].sign}{' '}
                    </span>
                    {formatAmountCents(transaction.amount_cents)}
                  </p>

                  <DisclosureIcon />
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ol>
  )
}

// The chevron marks a push into the row's own screen, which is what
// distinguishes this row from a control that opens a menu in place.
function DisclosureIcon() {
  return (
    <svg
      aria-hidden="true"
      className="-ml-0.5 -mr-1 size-4 shrink-0 text-faint"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
