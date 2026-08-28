import { Constants } from '../../lib/supabase/database.types'
import type { TransactionKind } from './transaction-types'

// The generated enum stays the type and runtime source of truth; this module
// owns only the Portuguese product presentation layered on top of it.
export const TRANSACTION_KIND_ORDER = Constants.public.Enums.transaction_kind

type TransactionKindMeta = {
  amountClassName: string
  badgeSoftClassName: string
  badgeTextClassName: string
  descriptionPlaceholder: string
  dotClassName: string
  footnote: string
  label: string
  sign: '+' | '−'
}

// A `Record` keyed by every member of the generated union forces TypeScript
// to fail this file if the enum widens without a matching product decision.
export const TRANSACTION_KIND_META: Record<
  TransactionKind,
  TransactionKindMeta
> = {
  income: {
    amountClassName: 'text-income-ink',
    badgeSoftClassName: 'bg-income-soft',
    badgeTextClassName: 'text-income',
    descriptionPlaceholder: 'De onde veio essa grana?',
    dotClassName: 'bg-income',
    footnote: 'Aumenta o saldo do dia.',
    label: 'Entrada',
    sign: '+',
  },
  expense: {
    amountClassName: 'text-expense-ink',
    badgeSoftClassName: 'bg-expense-soft',
    badgeTextClassName: 'text-expense',
    descriptionPlaceholder: 'Onde foi parar essa grana?',
    dotClassName: 'bg-expense',
    footnote: 'Reduz o saldo do dia como gasto pontual.',
    label: 'Saída',
    sign: '−',
  },
  daily: {
    amountClassName: 'text-daily-ink',
    badgeSoftClassName: 'bg-daily-soft',
    badgeTextClassName: 'text-daily',
    descriptionPlaceholder: 'Onde foi parar essa grana?',
    dotClassName: 'bg-daily',
    footnote: 'Conta como gasto diário da rotina.',
    label: 'Diário',
    sign: '−',
  },
  savings: {
    amountClassName: 'text-savings-ink',
    badgeSoftClassName: 'bg-savings-soft',
    badgeTextClassName: 'text-savings',
    descriptionPlaceholder: 'Onde foi parar essa grana?',
    dotClassName: 'bg-savings',
    footnote: 'Reserva valor e também reduz o saldo disponível.',
    label: 'Economia',
    sign: '−',
  },
}

// Inline local SVG marks, one distinct glyph per kind. No icon-library
// dependency and no React Native runtime carried over from the legacy app.
const TRANSACTION_KIND_MARK_PATHS: Record<TransactionKind, React.ReactNode> = {
  income: (
    <path
      d="M12 19V5m0 0L7 10m5-5 5 5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  expense: (
    <path
      d="M12 5v14m0 0 5-5m-5 5-5-5"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="1.8"
    />
  ),
  daily: (
    <>
      <rect
        height="11"
        rx="2.2"
        stroke="currentColor"
        strokeWidth="1.5"
        width="17.6"
        x="3.2"
        y="6.5"
      />
      <circle cx="12" cy="12" r="2.4" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M12 10.3v3.4m0 0-1.4-1.4M12 13.7l1.4-1.4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.4"
      />
    </>
  ),
  savings: (
    <>
      <path
        d="M4.5 13c0-3.3 2.9-5.8 6.7-5.8.9 0 1.7.1 2.5.4.5-.6 1.3-1 2.1-1l-.3 1.7c.9.8 1.5 1.9 1.5 3.2v.6c0 .9-.6 1.6-1.4 1.9l-.3 2.4h-1.8l-.2-1.9c-.7.2-1.4.3-2.1.3H9l-.4 1.6H6.8l-.3-2c-1.1-.6-2-1.7-2-2.9Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.5"
      />
      <circle cx="9.6" cy="11.8" r="0.9" fill="currentColor" />
      <path
        d="M8 15.5v1.3M14.4 15.3v1.3"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.4"
      />
    </>
  ),
}

type TransactionKindMarkProps = {
  className?: string
  kind: TransactionKind
}

export function TransactionKindMark({
  className,
  kind,
}: TransactionKindMarkProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
    >
      {TRANSACTION_KIND_MARK_PATHS[kind]}
    </svg>
  )
}

type TransactionKindBadgeProps = {
  className?: string
  kind: TransactionKind
  markClassName?: string
}

// The rounded badge used by the form's kind picker and the list row: a soft
// category background carrying the mark in the kind's primary color.
export function TransactionKindBadge({
  className,
  kind,
  markClassName,
}: TransactionKindBadgeProps) {
  const meta = TRANSACTION_KIND_META[kind]

  return (
    <span
      aria-hidden="true"
      className={`grid shrink-0 place-items-center rounded-2xl ${meta.badgeSoftClassName} ${meta.badgeTextClassName} ${className ?? ''}`}
    >
      <TransactionKindMark className={markClassName} kind={kind} />
    </span>
  )
}

type TransactionKindDotProps = {
  className?: string
  kind: TransactionKind
}

export function TransactionKindDot({
  className,
  kind,
}: TransactionKindDotProps) {
  const meta = TRANSACTION_KIND_META[kind]

  return (
    <span
      aria-hidden="true"
      className={`shrink-0 rounded-full ${meta.dotClassName} ${className ?? ''}`}
    />
  )
}
