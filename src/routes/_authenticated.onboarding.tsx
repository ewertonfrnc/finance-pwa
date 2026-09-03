import {
  createFileRoute,
  isRedirect,
  redirect,
  useRouter,
} from '@tanstack/react-router'

import { useNetworkStatus } from '../lib/use-network-status'
import { StartingPositionPage } from '../features/starting-position/starting-position-page'
import { startingPositionQueryOptions } from '../features/starting-position/starting-position-queries'
import { getLocalCurrentMonth } from '../features/transactions/transaction-calendar'
import { signOutLocally } from '../features/auth/auth-service'

export const Route = createFileRoute('/_authenticated/onboarding')({
  beforeLoad: async ({ context }) => {
    const userId = context.auth.session?.user.id

    if (!userId) return

    try {
      const position = await context.queryClient.fetchQuery(
        startingPositionQueryOptions(userId),
      )

      if (position !== null) {
        throw redirect({ replace: true, to: '/app' })
      }
    } catch (error) {
      if (isRedirect(error)) throw error
      throw error
    }
  },
  component: OnboardingRoute,
  errorComponent: OnboardingError,
})

function handleAlreadySaved() {
  const month = getLocalCurrentMonth()
  window.location.replace(
    `/app/starting-position?month=${month}&notice=already-saved`,
  )
}

function OnboardingRoute() {
  const { session } = Route.useRouteContext()
  const router = useRouter()

  async function handleLogout() {
    try {
      await signOutLocally()
    } catch {
      await router.invalidate()
    }
  }

  function handleComplete() {
    void router.invalidate()
    void router.navigate({ replace: true, to: '/app' })
  }

  return (
    <StartingPositionPage
      onAlreadySaved={handleAlreadySaved}
      onComplete={handleComplete}
      onLogout={() => void handleLogout()}
      userId={session.user.id}
    />
  )
}

function OnboardingError({ reset }: { error: unknown; reset: () => void }) {
  const router = useRouter()
  const isOnline = useNetworkStatus()

  async function handleRetry() {
    await router.invalidate()
    reset()
  }

  async function handleLogout() {
    try {
      await signOutLocally()
    } catch {
      await router.invalidate()
    }
  }

  const isOffline = !isOnline

  return (
    <main
      className="grid min-h-svh place-items-center px-5 py-12"
      data-page-canvas="subtle"
    >
      <section className="w-full max-w-md rounded-4xl border border-line bg-panel p-7 shadow-(--finance-shadow)">
        <h1 className="text-xl font-semibold tracking-tight text-ink">
          {isOffline
            ? 'Você está offline'
            : 'Não foi possível carregar o onboarding'}
        </h1>
        <p className="mt-3 leading-7 text-muted">
          {isOffline
            ? 'Conecte-se para configurar seu ponto de partida.'
            : 'Tente novamente. Se o problema persistir, saia e entre novamente.'}
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <button
            className="min-h-11 flex-1 rounded-full bg-ink px-6 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => void handleRetry()}
            type="button"
          >
            Tentar novamente
          </button>
          <button
            className="min-h-11 flex-1 rounded-full border border-line bg-panel px-6 text-sm font-semibold text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={() => void handleLogout()}
            type="button"
          >
            Sair
          </button>
        </div>
      </section>
    </main>
  )
}
