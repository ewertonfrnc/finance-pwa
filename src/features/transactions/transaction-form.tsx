import { useBlocker } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'

import { useUnsavedChangesGuard } from '../../app/unsaved-changes'
import { useNetworkStatus } from '../../lib/use-network-status'
import { formatTransactionDateFootnote } from './transaction-calendar'
import {
  validateTransactionFormInput,
  type TransactionFormFieldErrors,
  type TransactionFormInput,
  type TransactionPayload,
} from './transaction-form-schema'
import { formatCentavoDigits, parseCentavoDigits } from './transaction-money'
import {
  TRANSACTION_DESCRIPTION_MAX_LENGTH,
  type TransactionKind,
} from './transaction-types'

const KIND_LABEL: Record<TransactionKind, string> = {
  expense: 'Saída',
  income: 'Entrada',
}

const KIND_FOOTNOTE: Record<TransactionKind, string> = {
  expense: 'Reduz o saldo do dia como gasto pontual.',
  income: 'Aumenta o saldo do dia.',
}

const KIND_PLACEHOLDER: Record<TransactionKind, string> = {
  expense: 'Onde foi parar essa grana?',
  income: 'De onde veio essa grana?',
}

type TransactionFormProps = {
  confirmLabel: string
  errorAction?: { label: string; onAction: () => void }
  errorCopy: string | null
  footer?: React.ReactNode
  initialValues: TransactionFormInput
  isPending: boolean
  isSaved: boolean
  onCancel: () => void
  onSubmit: (payload: TransactionPayload) => void
  pendingLabel: string
  title: string
}

export function TransactionForm({
  confirmLabel,
  errorAction,
  errorCopy,
  footer,
  initialValues,
  isPending,
  isSaved,
  onCancel,
  onSubmit,
  pendingLabel,
  title,
}: TransactionFormProps) {
  const fieldId = useId()
  const isOnline = useNetworkStatus()

  const [kind, setKind] = useState(initialValues.kind)
  const [amountDigits, setAmountDigits] = useState(initialValues.amountDigits)
  const [description, setDescription] = useState(initialValues.description)
  const [date, setDate] = useState(initialValues.date)
  const [errors, setErrors] = useState<TransactionFormFieldErrors>({})
  const [isKindPickerOpen, setIsKindPickerOpen] = useState(false)

  const amountRef = useRef<HTMLInputElement>(null)
  const descriptionRef = useRef<HTMLInputElement>(null)
  const kindRef = useRef<HTMLButtonElement>(null)
  const dateRef = useRef<HTMLInputElement>(null)

  const isDirty =
    kind !== initialValues.kind ||
    amountDigits !== initialValues.amountDigits ||
    description !== initialValues.description ||
    date !== initialValues.date

  const blocksNavigation = isDirty && !isSaved

  useUnsavedChangesGuard(blocksNavigation)

  const blocker = useBlocker({
    disabled: !blocksNavigation,
    // The app-level unsaved-changes context owns beforeunload, so the router
    // must not register a second handler for the same draft.
    enableBeforeUnload: false,
    shouldBlockFn: () => true,
    withResolver: true,
  })

  // A formatted value moves the caret to the middle of the mask on every
  // keystroke, so digit entry keeps it at the end.
  useEffect(() => {
    const input = amountRef.current

    if (
      !input ||
      document.activeElement !== input ||
      input.value !== formatAmountInputValue(amountDigits)
    ) {
      return
    }

    input.setSelectionRange(input.value.length, input.value.length)
  }, [amountDigits])

  function handleAmountChange(value: string) {
    const digits = value.replace(/\D/g, '').replace(/^0+(?=\d)/, '')

    // Ignore a keystroke that would push the amount past the safe integer
    // range instead of silently truncating what the user typed.
    if (digits.length > 0 && parseCentavoDigits(digits) === null) return

    setAmountDigits(digits)
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const result = validateTransactionFormInput({
      amountDigits,
      date,
      description,
      kind,
    })

    if (!result.ok) {
      setErrors(result.errors)
      focusFirstInvalidField(result.errors, {
        amount: amountRef,
        date: dateRef,
        description: descriptionRef,
        kind: kindRef,
      })
      return
    }

    setErrors({})
    onSubmit(result.payload)
  }

  const confirmFootnote = !isOnline
    ? 'Sem conexão. O rascunho continua aqui; conecte-se para lançar.'
    : isPending
      ? 'Salvando e atualizando o mês...'
      : null
  const confirmFootnoteId = `${fieldId}-confirm-footnote`
  const kindFootnoteId = `${fieldId}-kind-footnote`
  const kindPickerId = `${fieldId}-kind-picker`
  const descriptionFootnote = description.trim()
    ? `${description.trim().length}/${TRANSACTION_DESCRIPTION_MAX_LENGTH}`
    : undefined
  const dateFootnote = readDateFootnote(date)

  return (
    <form
      className="min-h-svh"
      data-page-canvas="subtle"
      noValidate
      onSubmit={handleSubmit}
    >
      <header className="finance-safe-top finance-safe-x sticky top-0 z-40 border-b border-line bg-subtle">
        <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
          <button
            aria-describedby={confirmFootnote ? confirmFootnoteId : undefined}
            className="-ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onCancel}
            type="button"
          >
            Cancelar
          </button>

          <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink">
            {title}
          </h1>

          <button
            className="-mr-2 min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isPending || !isOnline}
            type="submit"
          >
            {isPending ? pendingLabel : confirmLabel}
          </button>
        </div>

        {confirmFootnote ? (
          <div className="mx-auto w-full max-w-2xl px-4 pb-2 text-right sm:px-6">
            <p
              className="text-xs font-medium text-muted"
              id={confirmFootnoteId}
            >
              {confirmFootnote}
            </p>
          </div>
        ) : null}
      </header>

      <div className="finance-safe-bottom finance-safe-x">
        <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
          {errorCopy ? (
            <div
              className="rounded-3xl border border-expense/40 bg-expense-soft px-4 py-3"
              role="alert"
            >
              <p className="text-sm font-medium text-ink">{errorCopy}</p>

              {errorAction ? (
                <button
                  className="mt-3 min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={errorAction.onAction}
                  type="button"
                >
                  {errorAction.label}
                </button>
              ) : null}
            </div>
          ) : null}

          <StandaloneField
            error={errors.amount}
            errorId={`${fieldId}-amount-error`}
            footnoteId={`${fieldId}-amount-footnote`}
            label="Valor"
          >
            <span className="flex items-baseline font-mono text-4xl font-semibold tabular-nums">
              <span aria-hidden="true" className="shrink-0 text-ink">
                R$&nbsp;
              </span>
              <input
                aria-describedby={
                  errors.amount ? `${fieldId}-amount-error` : undefined
                }
                aria-invalid={errors.amount ? true : undefined}
                aria-label="Valor"
                autoComplete="off"
                className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
                id={`${fieldId}-amount`}
                inputMode="numeric"
                onChange={(event) => handleAmountChange(event.target.value)}
                placeholder="0,00"
                ref={amountRef}
                value={formatAmountInputValue(amountDigits)}
              />
            </span>
          </StandaloneField>

          <StandaloneField
            error={errors.description}
            errorId={`${fieldId}-description-error`}
            footnote={descriptionFootnote}
            footnoteId={`${fieldId}-description-footnote`}
            label="Descrição (opcional)"
          >
            <input
              aria-describedby={
                errors.description
                  ? `${fieldId}-description-error`
                  : descriptionFootnote
                    ? `${fieldId}-description-footnote`
                    : undefined
              }
              aria-invalid={errors.description ? true : undefined}
              className="min-h-11 w-full bg-transparent text-base font-medium text-ink outline-none placeholder:text-faint"
              id={`${fieldId}-description`}
              maxLength={TRANSACTION_DESCRIPTION_MAX_LENGTH}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={KIND_PLACEHOLDER[kind]}
              ref={descriptionRef}
              type="text"
              value={description}
            />
          </StandaloneField>

          <section aria-labelledby={`${fieldId}-details-title`}>
            <h2
              className="px-1 pb-2 text-sm font-semibold text-muted"
              id={`${fieldId}-details-title`}
            >
              Detalhes
            </h2>

            <div className="overflow-hidden rounded-3xl bg-panel ring-1 ring-line/60">
              <button
                aria-controls={kindPickerId}
                aria-describedby={kindFootnoteId}
                aria-expanded={isKindPickerOpen}
                aria-label={`Tipo: ${KIND_LABEL[kind]}`}
                className="flex min-h-15 w-full items-center gap-3 px-4 text-left transition hover:bg-canvas/60 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-accent"
                onClick={() => setIsKindPickerOpen((open) => !open)}
                ref={kindRef}
                type="button"
              >
                <KindIcon kind={kind} />
                <span className="font-medium text-ink">Tipo</span>
                <span className="ml-auto inline-flex min-h-9 items-center gap-2 rounded-full bg-subtle px-3 text-sm font-semibold text-ink">
                  <KindDot kind={kind} />
                  {KIND_LABEL[kind]}
                  <ChevronIcon isOpen={isKindPickerOpen} />
                </span>
              </button>

              <div
                aria-hidden={!isKindPickerOpen}
                className={`grid transition-[grid-template-rows,opacity] duration-200 ease-out motion-reduce:transition-none ${
                  isKindPickerOpen
                    ? 'grid-rows-[1fr] opacity-100'
                    : 'grid-rows-[0fr] opacity-0'
                }`}
                id={kindPickerId}
              >
                <div className="overflow-hidden">
                  <fieldset
                    className="border-t border-line px-4 py-2"
                    disabled={!isKindPickerOpen}
                  >
                    <legend className="sr-only">Escolha o tipo</legend>
                    {(['expense', 'income'] as const).map((option) => (
                      <label
                        className="flex min-h-12 cursor-pointer items-center gap-3 border-b border-line/80 text-sm transition-colors duration-150 last:border-b-0 hover:bg-canvas/60 has-focus-visible:outline-2 has-focus-visible:-outline-offset-2 has-focus-visible:outline-accent motion-reduce:transition-none"
                        key={option}
                      >
                        <input
                          aria-describedby={kindFootnoteId}
                          checked={kind === option}
                          className="sr-only"
                          name={`${fieldId}-kind`}
                          onChange={() => setKind(option)}
                          onClick={() => {
                            setIsKindPickerOpen(false)
                            kindRef.current?.focus()
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Escape') {
                              setIsKindPickerOpen(false)
                              kindRef.current?.focus()
                            }
                          }}
                          type="radio"
                          value={option}
                        />
                        <KindDot kind={option} />
                        <span className="font-medium text-ink">
                          {KIND_LABEL[option]}
                        </span>
                        {kind === option ? <CheckIcon /> : null}
                      </label>
                    ))}
                  </fieldset>
                </div>
              </div>

              <p
                className={`px-4 pb-3 text-xs leading-5 ${errors.kind ? 'font-medium text-expense-ink' : 'text-muted'}`}
                id={kindFootnoteId}
                role={errors.kind ? 'alert' : undefined}
              >
                {errors.kind ?? KIND_FOOTNOTE[kind]}
              </p>

              <div className="mx-4 border-t border-line" />

              <label className="flex min-h-15 cursor-pointer items-center gap-3 px-4 transition hover:bg-canvas/60">
                <CalendarIcon />
                <span className="font-medium text-ink">Data</span>
                <span className="ml-auto rounded-full bg-subtle px-3 py-1.5 transition-shadow focus-within:ring-2 focus-within:ring-accent">
                  <input
                    aria-describedby={
                      errors.date
                        ? `${fieldId}-date-error`
                        : `${fieldId}-date-footnote`
                    }
                    aria-invalid={errors.date ? true : undefined}
                    className="min-h-8 w-40 max-w-full bg-transparent text-right text-sm font-semibold text-ink outline-none"
                    id={`${fieldId}-date`}
                    onChange={(event) => setDate(event.target.value)}
                    ref={dateRef}
                    type="date"
                    value={date}
                  />
                </span>
              </label>
            </div>

            {errors.date ? (
              <p
                className="px-1 pt-2 text-xs font-medium text-expense-ink"
                id={`${fieldId}-date-error`}
                role="alert"
              >
                {errors.date}
              </p>
            ) : dateFootnote ? (
              <p
                className="px-1 pt-2 text-xs text-muted"
                id={`${fieldId}-date-footnote`}
              >
                {dateFootnote}
              </p>
            ) : null}
          </section>

          {footer ? (
            <div className="border-t border-line pt-6">{footer}</div>
          ) : null}
        </div>
      </div>

      {blocker.status === 'blocked' ? (
        <DiscardDialog onDiscard={blocker.proceed} onKeep={blocker.reset} />
      ) : null}
    </form>
  )
}

type StandaloneFieldProps = {
  children: React.ReactNode
  error?: string
  errorId: string
  footnote?: string
  footnoteId: string
  label: string
}

function StandaloneField({
  children,
  error,
  errorId,
  footnote,
  footnoteId,
  label,
}: StandaloneFieldProps) {
  return (
    <div>
      <label className="block">
        <span className="block px-1 pb-2 text-sm font-semibold text-muted">
          {label}
        </span>
        <span className="block rounded-3xl bg-panel px-4 py-3 ring-1 ring-line/60 transition focus-within:ring-2 focus-within:ring-accent">
          {children}
        </span>
      </label>

      {error ? (
        <p
          className="px-1 pt-2 text-xs font-medium text-expense-ink"
          id={errorId}
          role="alert"
        >
          {error}
        </p>
      ) : footnote ? (
        <p className="px-1 pt-2 text-xs text-muted" id={footnoteId}>
          {footnote}
        </p>
      ) : null}
    </div>
  )
}

function KindIcon({ kind }: { kind: TransactionKind }) {
  return (
    <span
      aria-hidden="true"
      className={`grid size-9 shrink-0 place-items-center rounded-2xl ${
        kind === 'income'
          ? 'bg-income-soft text-income'
          : 'bg-expense-soft text-expense'
      }`}
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24">
        <path
          d={
            kind === 'income'
              ? 'M12 19V5m0 0L7 10m5-5 5 5'
              : 'M12 5v14m0 0 5-5m-5 5-5-5'
          }
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  )
}

function KindDot({ kind }: { kind: TransactionKind }) {
  return (
    <span
      aria-hidden="true"
      className={`size-2.5 shrink-0 rounded-full ${
        kind === 'income' ? 'bg-income' : 'bg-expense'
      }`}
    />
  )
}

function ChevronIcon({ isOpen }: { isOpen: boolean }) {
  return (
    <svg
      aria-hidden="true"
      className={`size-4 text-muted transition-transform duration-200 ease-out motion-reduce:transition-none ${isOpen ? 'rotate-180' : ''}`}
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m8 10 4 4 4-4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      className="ml-auto size-5 text-accent-ink"
      fill="none"
      viewBox="0 0 24 24"
    >
      <path
        d="m5 12 4 4L19 6"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid size-9 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink"
    >
      <svg className="size-4" fill="none" viewBox="0 0 24 24">
        <path
          d="M7 3v3m10-3v3M4 9h16M6 5h12a2 2 0 0 1 2 2v12H4V7a2 2 0 0 1 2-2Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      </svg>
    </span>
  )
}

function DiscardDialog({
  onDiscard,
  onKeep,
}: {
  onDiscard: () => void
  onKeep: () => void
}) {
  return (
    <dialog
      aria-labelledby="discard-draft-title"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-3xl border border-line bg-panel p-5 text-left shadow-(--finance-shadow-strong) sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
      open
    >
      <h2 className="text-lg font-semibold text-ink" id="discard-draft-title">
        Descartar este lançamento?
      </h2>
      <p className="mt-1 text-sm leading-6 text-muted">
        O que você preencheu ainda não foi salvo.
      </p>

      <div className="mt-4 flex justify-end gap-2">
        <button
          className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onKeep}
          type="button"
        >
          Continuar editando
        </button>
        <button
          className="min-h-11 rounded-full bg-expense px-5 text-sm font-semibold text-canvas transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onDiscard}
          type="button"
        >
          Descartar
        </button>
      </div>
    </dialog>
  )
}

function readDateFootnote(date: string) {
  try {
    return formatTransactionDateFootnote(date)
  } catch {
    return undefined
  }
}

function formatAmountInputValue(digits: string) {
  if (!digits) return ''

  return formatCentavoDigits(digits).replace(/^R\$\s/, '')
}

function focusFirstInvalidField(
  errors: TransactionFormFieldErrors,
  refs: Record<
    keyof TransactionFormFieldErrors,
    React.RefObject<HTMLElement | null>
  >,
) {
  for (const field of ['amount', 'description', 'kind', 'date'] as const) {
    if (errors[field]) {
      refs[field].current?.focus()
      return
    }
  }
}
