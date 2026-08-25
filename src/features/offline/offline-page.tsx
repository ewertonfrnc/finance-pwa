import { Link } from '@tanstack/react-router'

import { BrandMark } from '../../components/brand-mark'
import { useNetworkStatus } from '../../lib/use-network-status'

export function OfflinePage() {
  const isOnline = useNetworkStatus()

  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-12">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 size-72 rounded-full bg-accent/25 blur-3xl"
      />
      <section className="relative w-full max-w-2xl rounded-4xl border border-line bg-panel p-7 shadow-(--finance-shadow) sm:p-10">
        <BrandMark className="size-12 text-ink" />
        <p className="mt-10 text-sm font-semibold uppercase tracking-[0.14em] text-accent-ink">
          Modo offline
        </p>
        <h1 className="mt-4 max-w-xl text-4xl leading-tight font-semibold tracking-[-0.04em] text-ink sm:text-6xl">
          Sem internet, sem dados desatualizados.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-8 text-muted">
          A estrutura do Finance abre mesmo sem conexão. Login, consultas e
          qualquer lançamento financeiro ficam bloqueados até a internet voltar.
        </p>

        <div className="mt-8 flex items-center gap-3 rounded-2xl border border-line bg-canvas px-4 py-3">
          <span
            aria-hidden="true"
            className={`size-2.5 rounded-full ${isOnline ? 'bg-success' : 'bg-warning-ink'}`}
          />
          <output className="text-sm font-medium text-ink">
            {isOnline
              ? 'Você está com conexão agora.'
              : 'Você está sem conexão agora.'}
          </output>
        </div>

        <Link
          className="mt-8 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          to="/"
        >
          Voltar ao início
        </Link>
      </section>
    </main>
  )
}
