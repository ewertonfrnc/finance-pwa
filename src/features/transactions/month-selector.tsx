import {
  formatTransactionMonth,
  shiftTransactionMonth,
} from './transaction-calendar'
import type { TransactionMonth } from './transaction-types'

type MonthSelectorProps = {
  month: TransactionMonth
  onMonthChange: (month: TransactionMonth) => void
}

export function MonthSelector({ month, onMonthChange }: MonthSelectorProps) {
  const previousMonth = shiftTransactionMonth(month, -1)
  const nextMonth = shiftTransactionMonth(month, 1)

  return (
    <div className="flex min-w-0 items-center">
      <button
        aria-label="Mês anterior"
        className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35"
        disabled={!previousMonth}
        onClick={() => {
          if (previousMonth) onMonthChange(previousMonth)
        }}
        type="button"
      >
        <ChevronIcon direction="left" />
      </button>

      <h1 className="min-w-0 truncate px-1 text-center text-sm font-semibold tracking-tight text-ink sm:px-2 sm:text-base">
        {formatTransactionMonth(month)}
      </h1>

      <button
        aria-label="Próximo mês"
        className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-35"
        disabled={!nextMonth}
        onClick={() => {
          if (nextMonth) onMonthChange(nextMonth)
        }}
        type="button"
      >
        <ChevronIcon direction="right" />
      </button>
    </div>
  )
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d={direction === 'left' ? 'm15 18-6-6 6-6' : 'm9 6 6 6-6 6'}
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}
