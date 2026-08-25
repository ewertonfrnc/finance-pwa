import { useState } from 'react'

import { BrandMark } from '../components/brand-mark'
import { AUTH_ERROR_COPY } from '../features/auth/auth-errors'
import { signOutLocally } from '../features/auth/auth-service'
import { MonthSelector } from '../features/transactions/month-selector'
import type { TransactionMonth } from '../features/transactions/transaction-types'
import { TransactionsPage } from '../features/transactions/transactions-page'

type AuthenticatedAppPageProps = {
  email: string
  month: TransactionMonth
  onMonthChange: (month: TransactionMonth) => void
  userId: string
}

export function AuthenticatedAppPage({
  email,
  month,
  onMonthChange,
  userId,
}: AuthenticatedAppPageProps) {
  const [isPending, setIsPending] = useState(false)
  const [errorCopy, setErrorCopy] = useState<string | null>(null)

  async function handleLogout() {
    setErrorCopy(null)
    setIsPending(true)

    try {
      await signOutLocally()
    } catch {
      setErrorCopy(AUTH_ERROR_COPY.logout)
      setIsPending(false)
    }
  }

  return (
    <main className="finance-safe-bottom min-h-svh">
      <header className="finance-safe-top sticky top-0 z-40 border-b border-line/80 bg-canvas/90 backdrop-blur-xl">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6">
          <div className="flex min-h-14 items-center justify-between gap-3">
            <a
              aria-label="Ir para o início"
              className="inline-flex min-h-11 items-center gap-2 rounded-2xl font-semibold text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href="/"
            >
              <BrandMark className="size-9 text-ink" />
              <span>Finance</span>
            </a>

            <div className="flex min-w-0 items-center gap-3">
              <span className="max-w-24 truncate text-xs text-muted sm:max-w-56 sm:text-sm">
                {email}
              </span>
              <button
                className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-65"
                disabled={isPending}
                onClick={handleLogout}
                type="button"
              >
                {isPending ? 'Saindo...' : 'Sair'}
              </button>
            </div>
          </div>

          <div className="mx-auto w-full max-w-sm pb-2">
            <MonthSelector month={month} onMonthChange={onMonthChange} />
          </div>

          {errorCopy ? (
            <p
              className="mb-3 rounded-2xl border border-expense/40 bg-expense-soft px-4 py-3 text-sm font-medium text-ink"
              role="alert"
            >
              {errorCopy}
            </p>
          ) : null}
        </div>
      </header>

      <TransactionsPage month={month} userId={userId} />
    </main>
  )
}
