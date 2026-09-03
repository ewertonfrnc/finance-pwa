import { Link } from '@tanstack/react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { useNetworkStatus } from '../../lib/use-network-status'
import { formatSignedCents } from '../../lib/brl-money'
import { startingPositionQueryOptions } from './starting-position-queries'

type StartingPositionDetailPageProps = {
  backMonth: string
  notice?: string | null
  userId: string
}

function formatLongDate(value: string) {
  try {
    const [year, month, day] = value.split('-').map(Number)
    const date = new Date(0)
    date.setHours(12, 0, 0, 0)
    date.setFullYear(year, month - 1, day)
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' }).format(date)
  } catch {
    return value
  }
}

export function StartingPositionDetailPage({
  backMonth,
  notice,
  userId,
}: StartingPositionDetailPageProps) {
  const queryClient = useQueryClient()
  const isOnline = useNetworkStatus()
  const query = useQuery(startingPositionQueryOptions(userId))

  const cached = queryClient.getQueryData(
    startingPositionQueryOptions(userId).queryKey,
  )
  // Prefer cached row when available to avoid a second fetch; the query itself
  // will still hydrate from cache (static) without refetching.
  const position = (query.data ?? cached ?? null) as
    | { balance_cents: number; effective_on: string; user_id: string }
    | null
    | undefined

  const isLoading = query.isLoading && !cached
  const isError = query.isError

  async function handleRetry() {
    await query.refetch()
  }

  return (
    <main className="min-h-svh" data-page-canvas="subtle">
      <header className="finance-safe-top finance-safe-x sticky top-0 z-40 border-b border-line bg-subtle">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <Link
            aria-label="Voltar para lançamentos"
            className="grid size-11 place-items-center rounded-full text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            search={{ month: backMonth } as never}
            to="/app"
          >
            <BackIcon />
          </Link>
          <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink">
            Ponto de partida
          </h1>
          <span aria-hidden="true" className="size-11" />
        </div>
      </header>

      <div className="finance-safe-bottom finance-safe-x">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
          {notice === 'already-saved' ? (
            <output className="block rounded-3xl border border-line bg-panel px-4 py-3 ring-1 ring-line/60">
              <p className="text-sm font-medium text-ink">
                Um ponto de partida já foi salvo com outros valores.
              </p>
              <p className="mt-1 text-sm leading-6 text-muted">
                O valor exibido abaixo foi mantido. O rascunho que você enviou
                não foi salvo.
              </p>
            </output>
          ) : null}

          {isLoading ? (
            <div className="rounded-3xl bg-panel p-5 ring-1 ring-line/60">
              <p className="text-sm font-medium text-muted">
                Carregando ponto de partida...
              </p>
            </div>
          ) : isError ? (
            <div className="rounded-3xl bg-panel p-5 ring-1 ring-line/60">
              <h2 className="text-sm font-semibold text-ink">
                {!isOnline
                  ? 'Você está offline'
                  : 'Não foi possível carregar seu ponto de partida'}
              </h2>
              <p className="mt-2 text-sm leading-6 text-muted">
                {!isOnline
                  ? 'Conecte-se para ver seu ponto de partida.'
                  : 'Tente novamente. Se o problema persistir, saia e entre novamente.'}
              </p>
              <button
                className="mt-4 min-h-11 w-full rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={() => void handleRetry()}
                type="button"
              >
                Tentar novamente
              </button>
            </div>
          ) : position ? (
            <div className="rounded-3xl bg-panel p-5 ring-1 ring-line/60">
              <dl className="space-y-4">
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Saldo na abertura
                  </dt>
                  <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
                    {formatSignedCents(position.balance_cents)}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold text-muted">
                    Data de abertura
                  </dt>
                  <dd className="mt-1 text-sm font-medium text-ink">
                    {formatLongDate(position.effective_on)}
                  </dd>
                  <dd className="text-xs text-muted">
                    {position.effective_on}
                  </dd>
                </div>
              </dl>
              <p className="mt-4 text-sm leading-6 text-muted">
                Esse é o saldo na abertura de{' '}
                {formatLongDate(position.effective_on)}. Lançamentos do mesmo
                dia entram depois dele.
              </p>
              <p className="mt-2 text-sm leading-6 text-muted">
                Esse valor não pode ser alterado nesta versão.
              </p>
            </div>
          ) : (
            <div className="rounded-3xl bg-panel p-5 ring-1 ring-line/60">
              <p className="text-sm font-medium text-muted">
                Nenhum ponto de partida encontrado.
              </p>
            </div>
          )}

          <Link
            className="flex min-h-11 w-full items-center justify-center rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            search={{ month: backMonth } as never}
            to="/app"
          >
            Voltar para lançamentos
          </Link>

          <p className="px-1 text-center text-xs text-muted">
            Seu ponto de partida fica salvo para este usuário e é exigido para
            abrir o app em qualquer dispositivo.
          </p>
        </div>
      </div>
    </main>
  )
}

function BackIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M15 18l-6-6 6-6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
