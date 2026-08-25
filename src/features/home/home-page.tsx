import { Link } from '@tanstack/react-router'

import { BrandMark } from '../../components/brand-mark'

export function HomePage() {
  return (
    <main className="relative min-h-svh overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute -top-32 -right-32 size-80 rounded-full bg-accent/30 blur-3xl sm:size-128"
      />
      <div
        aria-hidden="true"
        className="absolute top-168 -left-28 size-72 rounded-full bg-coral/20 blur-3xl lg:top-32"
      />

      <header className="relative mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12 lg:py-8">
        <div className="flex items-center gap-3">
          <BrandMark className="size-11 text-ink" />
          <span className="font-display text-xl font-semibold tracking-tight text-ink">
            Finance
          </span>
        </div>
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-panel/70 px-5 text-sm font-semibold text-ink backdrop-blur transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          search={{ redirect: undefined }}
          to="/login"
        >
          Entrar
        </Link>
      </header>

      <section className="relative mx-auto grid w-full max-w-7xl items-center gap-12 px-5 pt-12 pb-20 sm:px-8 sm:pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(380px,0.82fr)] lg:gap-20 lg:px-12 lg:pt-24 lg:pb-28">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 rounded-full bg-accent-soft px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent-ink">
            <span className="size-2 rounded-full bg-accent-ink" />
            Seu mês, antes de acontecer
          </p>
          <h1 className="mt-7 max-w-3xl font-display text-[clamp(3rem,9vw,6.4rem)] leading-[0.94] font-semibold tracking-[-0.055em] text-ink">
            Veja o mês inteiro antes de gastar.
          </h1>
          <p className="mt-7 max-w-xl text-lg leading-8 text-muted sm:text-xl sm:leading-9">
            O Finance vai reunir o que já aconteceu e o que ainda está por vir,
            para cada decisão caber no mês real.
          </p>
          <div className="mt-9 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
            <Link
              className="inline-flex min-h-12 items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas shadow-(--finance-shadow-button) transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              to="/register"
            >
              Criar minha conta
            </Link>
            <a
              className="inline-flex min-h-12 items-center gap-2 px-2 font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 transition hover:decoration-accent-ink focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href="#primeira-versao"
            >
              Conhecer a primeira versão
              <ArrowIcon />
            </a>
          </div>
        </div>

        <MonthPreview />
      </section>

      <section
        className="relative border-t border-line/80 bg-panel/60"
        id="primeira-versao"
      >
        <div className="mx-auto grid w-full max-w-7xl gap-10 px-5 py-16 sm:px-8 lg:grid-cols-[0.75fr_1.25fr] lg:px-12 lg:py-24">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.14em] text-accent-ink">
              Primeira versão
            </p>
            <h2 className="mt-4 max-w-md font-display text-4xl font-semibold tracking-[-0.035em] text-ink sm:text-5xl">
              O básico precisa responder uma pergunta difícil.
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <article className="rounded-[1.75rem] border border-line bg-canvas p-6 sm:p-7">
              <span className="grid size-11 place-items-center rounded-2xl bg-accent-soft text-ink">
                <PencilIcon />
              </span>
              <h3 className="mt-8 font-display text-2xl font-semibold text-ink">
                O que mudou no meu saldo?
              </h3>
              <p className="mt-3 leading-7 text-muted">
                Entradas e despesas ficam no mês em que realmente acontecem.
              </p>
            </article>
            <article className="rounded-[1.75rem] border border-line bg-ink p-6 text-canvas sm:p-7">
              <span className="grid size-11 place-items-center rounded-2xl bg-canvas/10 text-accent">
                <CalendarIcon />
              </span>
              <h3 className="mt-8 font-display text-2xl font-semibold">
                Quanto ainda posso gastar?
              </h3>
              <p className="mt-3 leading-7 text-canvas/70">
                O saldo projetado considera lançamentos futuros e recorrentes.
              </p>
            </article>
          </div>
        </div>
      </section>

      <footer className="border-t border-line bg-panel px-5 py-6 text-sm text-muted sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p>Finance PWA é o nome temporário deste produto.</p>
          <p>Dados financeiros continuarão online-only na primeira versão.</p>
        </div>
      </footer>
    </main>
  )
}

function MonthPreview() {
  return (
    <aside
      aria-label="Prévia da visão mensal"
      className="relative mx-auto w-full max-w-lg rounded-[2.25rem] border border-white/10 bg-ink p-3 text-canvas shadow-(--finance-shadow-strong)"
    >
      <div className="rounded-[1.7rem] border border-canvas/10 bg-ink-soft p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-canvas/55">
              Prévia
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold tracking-tight">
              Visão do mês
            </h2>
          </div>
          <span className="rounded-full bg-accent-ink px-3 py-1.5 text-xs font-bold text-accent-contrast">
            Em construção
          </span>
        </div>

        <div className="mt-10 space-y-3">
          <PreviewRow
            detail="o ponto de partida"
            icon={<CurrentIcon />}
            title="Saldo atual"
          />
          <div className="ml-5 h-5 border-l border-dashed border-canvas/20" />
          <PreviewRow
            detail="o que ainda vai acontecer"
            icon={<FutureIcon />}
            title="Próximos lançamentos"
          />
          <div className="ml-5 h-5 border-l border-dashed border-canvas/20" />
          <PreviewRow
            detail="onde o mês pode chegar"
            icon={<ProjectionIcon />}
            title="Saldo projetado"
          />
        </div>

        <div className="mt-9 rounded-2xl border border-canvas/10 bg-canvas/5 px-4 py-3 text-sm leading-6 text-canvas/65">
          A base instalável está pronta. Login, transações e cálculos entram nas
          próximas etapas.
        </div>
      </div>
    </aside>
  )
}

type PreviewRowProps = {
  detail: string
  icon: React.ReactNode
  title: string
}

function PreviewRow({ detail, icon, title }: PreviewRowProps) {
  return (
    <div className="grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-3">
      <span className="grid size-10 place-items-center rounded-2xl bg-canvas/10 text-accent">
        {icon}
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-sm text-canvas/55">{detail}</p>
      </div>
    </div>
  )
}

function ArrowIcon() {
  return (
    <svg aria-hidden="true" className="size-4" fill="none" viewBox="0 0 16 16">
      <path
        d="M3 8h10m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
    </svg>
  )
}

function PencilIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m14.5 6.5 3 3M5 19l1-4 9.5-9.5a2.1 2.1 0 0 1 3 3L9 18l-4 1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M7 4v3m10-3v3M5 9h14M6 6h12a1 1 0 0 1 1 1v12H5V7a1 1 0 0 1 1-1Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function CurrentIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="7" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 8v4l2.5 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function FutureIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M6 12h12m-4-4 4 4-4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}

function ProjectionIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m5 16 5-5 3 3 6-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M15 7h4v4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
    </svg>
  )
}
