import { useState } from 'react'

import { BrandMark } from '../../components/brand-mark'
import { AUTH_ERROR_COPY } from './auth-errors'
import { signOutLocally } from './auth-service'

type AuthenticatedHomePageProps = {
  email: string
}

export function AuthenticatedHomePage({ email }: AuthenticatedHomePageProps) {
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
    <main className="min-h-svh px-5 py-8 sm:px-8 lg:px-12">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
        <a
          aria-label="Ir para o início"
          className="inline-flex items-center gap-3 rounded-2xl font-display text-xl font-semibold tracking-tight text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          href="/"
        >
          <BrandMark className="size-11 text-ink" />
          Finance
        </a>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel px-5 text-sm font-semibold text-ink transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-65"
          disabled={isPending}
          onClick={handleLogout}
          type="button"
        >
          {isPending ? 'Saindo...' : 'Sair'}
        </button>
      </div>

      <section className="mx-auto mt-20 w-full max-w-5xl rounded-4xl border border-line bg-panel p-7 shadow-[var(--finance-shadow)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
          Conta conectada
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-6xl">
          Seu espaço financeiro começa aqui.
        </h1>
        <p className="mt-6 text-lg text-muted">
          Sessão ativa para{' '}
          <strong className="font-semibold text-ink">{email}</strong>
        </p>
        <p className="mt-4 max-w-2xl leading-7 text-muted">
          O próximo passo vai registrar seu saldo inicial. Nenhum dado
          financeiro é solicitado nesta tela.
        </p>

        {errorCopy ? (
          <p
            className="mt-6 rounded-2xl border border-coral/45 bg-coral/10 px-4 py-3 text-sm font-medium text-ink"
            role="alert"
          >
            {errorCopy}
          </p>
        ) : null}
      </section>
    </main>
  )
}
