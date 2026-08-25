import { Link, Outlet } from '@tanstack/react-router'

import { BrandMark } from '../components/brand-mark'
import { NetworkStatus } from '../components/network-status'
import { PwaUpdatePrompt } from './pwa-update-prompt'

export function RootLayout() {
  return (
    <>
      <NetworkStatus />
      <Outlet />
      <PwaUpdatePrompt />
    </>
  )
}

export function NotFoundPage() {
  return (
    <main className="grid min-h-svh place-items-center px-5 py-12">
      <section className="w-full max-w-md rounded-[2rem] border border-line bg-panel p-7 shadow-[var(--finance-shadow)]">
        <BrandMark className="size-12 text-ink" />
        <p className="mt-8 text-sm font-semibold uppercase tracking-[0.16em] text-accent-ink">
          Página não encontrada
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight text-ink">
          Este endereço não existe.
        </h1>
        <p className="mt-4 leading-7 text-muted">
          Volte ao início para continuar no Finance.
        </p>
        <Link
          className="mt-7 inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          to="/"
        >
          Ir para o início
        </Link>
      </section>
    </main>
  )
}
