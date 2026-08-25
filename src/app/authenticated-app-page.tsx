import { useState } from 'react'

import { GlassCapsule } from '../components/glass-capsule'
import { AUTH_ERROR_COPY } from '../features/auth/auth-errors'
import { signOutLocally } from '../features/auth/auth-service'
import { MonthSelector } from '../features/transactions/month-selector'
import type { TransactionMonth } from '../features/transactions/transaction-types'
import { TransactionsPage } from '../features/transactions/transactions-page'

type AuthenticatedAppPageProps = {
  month: TransactionMonth
  onMonthChange: (month: TransactionMonth) => void
  userId: string
}

export function AuthenticatedAppPage({
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
    <main className="min-h-svh">
      <header
        aria-label="Controles do histórico"
        className="pointer-events-none sticky top-0 z-40 h-0"
      >
        <div className="finance-safe-top finance-safe-x mx-auto w-full max-w-3xl">
          <div className="flex items-start justify-between gap-2 px-4 pt-2 sm:px-6">
            <GlassCapsule className="pointer-events-auto min-w-0">
              <MonthSelector month={month} onMonthChange={onMonthChange} />
            </GlassCapsule>

            <GlassCapsule className="pointer-events-auto flex shrink-0 items-center">
              <button
                aria-label={isPending ? 'Saindo...' : 'Sair'}
                className="grid size-11 place-items-center rounded-full text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-50"
                disabled={isPending}
                onClick={handleLogout}
                type="button"
              >
                <LogoutIcon />
              </button>
              <button
                aria-describedby="transaction-create-availability"
                aria-disabled="true"
                aria-label="Adicionar"
                className="grid size-11 place-items-center rounded-full text-ink opacity-50 transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                type="button"
              >
                <PlusIcon />
              </button>
              <span className="sr-only" id="transaction-create-availability">
                O cadastro de lançamentos estará disponível na próxima etapa.
              </span>
            </GlassCapsule>
          </div>

          {errorCopy ? (
            <div className="flex justify-end px-4 sm:px-6">
              <p
                className="pointer-events-auto mt-2 max-w-sm rounded-2xl border border-expense/40 bg-expense-soft px-4 py-3 text-sm font-medium text-ink shadow-(--finance-shadow-subtle)"
                role="alert"
              >
                {errorCopy}
              </p>
            </div>
          ) : null}
        </div>
      </header>

      <TransactionsPage month={month} userId={userId} />
    </main>
  )
}

function LogoutIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M10 5H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h4M14 8l4 4-4 4m4-4H9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
