import type { ReactNode } from 'react'

import { BrandMark } from '../../components/brand-mark'

type AuthShellProps = {
  children: ReactNode
  description: string
  eyebrow: string
  title: string
}

export function AuthShell({
  children,
  description,
  eyebrow,
  title,
}: AuthShellProps) {
  return (
    <main className="relative grid min-h-svh place-items-center overflow-hidden px-5 py-10 sm:px-8">
      <div
        aria-hidden="true"
        className="absolute -top-24 -right-24 size-72 rounded-full bg-accent/30 blur-3xl sm:size-120"
      />
      <div
        aria-hidden="true"
        className="absolute -bottom-36 -left-28 size-80 rounded-full bg-coral/20 blur-3xl"
      />

      <section className="relative w-full max-w-md rounded-4xl border border-line bg-panel p-6 shadow-[var(--finance-shadow)] sm:p-8">
        <a
          aria-label="Voltar para o início"
          className="inline-flex rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          href="/"
        >
          <BrandMark className="size-12 text-ink" />
        </a>

        <p className="mt-9 text-xs font-semibold uppercase tracking-[0.16em] text-accent-ink">
          {eyebrow}
        </p>
        <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.04em] text-ink sm:text-5xl">
          {title}
        </h1>
        <p className="mt-4 leading-7 text-muted">{description}</p>

        <div className="mt-8">{children}</div>
      </section>
    </main>
  )
}
