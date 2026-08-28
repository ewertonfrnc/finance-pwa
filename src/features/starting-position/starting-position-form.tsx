import { useBlocker } from '@tanstack/react-router'
import { useEffect, useId, useRef, useState } from 'react'

import { useUnsavedChangesGuard } from '../../app/unsaved-changes'
import { getLocalTodayIsoDate } from '../../lib/calendar-date'
import {
  formatCentavoDigits,
  formatSignedCents,
  parseCentavoDigits,
} from '../../lib/brl-money'
import { useNetworkStatus } from '../../lib/use-network-status'
import {
  validateStartingPositionFormInput,
  type StartingPositionDirection,
  type StartingPositionFieldErrors,
  type StartingPositionPayload,
} from './starting-position-schema'

type StartingPositionFormProps = {
  errorCopy: string | null
  isPending: boolean
  onLogout: () => void
  onSubmit: (payload: StartingPositionPayload) => void
}

function formatAmountInputValue(digits: string) {
  if (!digits) return ''
  return formatCentavoDigits(digits).replace(/^R\$\s/, '')
}

function formatReviewDate(value: string) {
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

function focusFirstInvalidField(
  errors: StartingPositionFieldErrors,
  refs: {
    amount: React.RefObject<HTMLInputElement | null>
  },
) {
  if (errors.amount) {
    refs.amount.current?.focus()
  }
}

export function StartingPositionForm({
  errorCopy,
  isPending,
  onLogout,
  onSubmit,
}: StartingPositionFormProps) {
  const fieldId = useId()
  const isOnline = useNetworkStatus()

  const [amountDigits, setAmountDigits] = useState('')
  const [direction, setDirection] =
    useState<StartingPositionDirection>('available')
  const [errors, setErrors] = useState<StartingPositionFieldErrors>({})
  const [reviewPayload, setReviewPayload] =
    useState<StartingPositionPayload | null>(null)

  const amountRef = useRef<HTMLInputElement>(null)

  const isReviewing = reviewPayload !== null
  const isDirty =
    amountDigits !== '' || direction !== 'available' || isReviewing
  const blocksNavigation = isDirty

  useUnsavedChangesGuard(blocksNavigation)

  const blocker = useBlocker({
    disabled: !blocksNavigation,
    enableBeforeUnload: false,
    shouldBlockFn: () => true,
    withResolver: true,
  })

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
    if (digits.length > 0 && parseCentavoDigits(digits) === null) return
    setAmountDigits(digits)
  }

  function handleReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (isReviewing) return

    const effectiveOn = getLocalTodayIsoDate()

    const result = validateStartingPositionFormInput({
      amountDigits,
      direction,
      effectiveOn,
    })

    if (!result.ok) {
      setErrors(result.errors)
      focusFirstInvalidField(result.errors, {
        amount: amountRef,
      })
      return
    }

    setErrors({})
    setReviewPayload(result.payload)
  }

  function handleBackToEdit() {
    setReviewPayload(null)
  }

  function handleConfirm() {
    if (!reviewPayload) return
    onSubmit(reviewPayload)
  }

  const reviewAmount = reviewPayload
    ? formatSignedCents(reviewPayload.balance_cents)
    : ''
  const reviewDate = reviewPayload
    ? formatReviewDate(reviewPayload.effective_on)
    : ''

  const isConfirmDisabled = isPending || !isOnline
  const confirmFootnote = !isOnline
    ? 'Sem conexão. O rascunho continua aqui; conecte-se para confirmar.'
    : isPending
      ? 'Salvando ponto de partida...'
      : null
  const confirmFootnoteId = `${fieldId}-confirm-footnote`

  if (isReviewing && reviewPayload) {
    return (
      <>
        <form
          className="min-h-svh"
          data-page-canvas="subtle"
          noValidate
          onSubmit={(event) => event.preventDefault()}
        >
          <header className="finance-safe-top finance-safe-x sticky top-0 z-40 border-b border-line bg-subtle">
            <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
              <button
                className="-ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={onLogout}
                type="button"
              >
                Sair
              </button>
              <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink">
                Ponto de partida
              </h1>
              <span className="min-h-11 px-3" aria-hidden="true" />
            </div>
          </header>

          <div className="finance-safe-bottom finance-safe-x">
            <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
              {errorCopy ? (
                <div
                  className="rounded-3xl border border-coral-ring bg-coral-soft px-4 py-3"
                  role="alert"
                >
                  <p className="text-sm font-medium text-coral-ink">
                    {errorCopy}
                  </p>
                </div>
              ) : null}

              <div className="rounded-3xl bg-panel p-5 ring-1 ring-line/60">
                <h2 className="text-sm font-semibold text-muted">
                  Revise seu ponto de partida
                </h2>
                <dl className="mt-4 space-y-3">
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      Saldo na abertura
                    </dt>
                    <dd className="mt-1 font-mono text-2xl font-semibold tracking-tight text-ink">
                      {reviewAmount}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-semibold text-muted">
                      Data de abertura
                    </dt>
                    <dd className="mt-1 text-sm font-medium text-ink">
                      {reviewDate}
                    </dd>
                    <dd className="text-xs text-muted">
                      {reviewPayload.effective_on}
                    </dd>
                  </div>
                </dl>
                <p className="mt-4 text-sm leading-6 text-muted">
                  Esse valor vira seu ponto de partida e não poderá ser alterado
                  nesta versão. Lançamentos do mesmo dia entram depois dele.
                </p>
              </div>

              <div className="space-y-3">
                <button
                  aria-describedby={
                    confirmFootnote ? confirmFootnoteId : undefined
                  }
                  className="min-h-11 w-full rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
                  disabled={isConfirmDisabled}
                  onClick={handleConfirm}
                  type="button"
                >
                  {isPending ? 'Salvando...' : 'Confirmar ponto de partida'}
                </button>
                {confirmFootnote ? (
                  <p
                    className="text-center text-xs font-medium text-muted"
                    id={confirmFootnoteId}
                  >
                    {confirmFootnote}
                  </p>
                ) : null}
                <button
                  className="min-h-11 w-full rounded-full border border-line bg-panel px-4 text-sm font-semibold text-ink transition hover:bg-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={handleBackToEdit}
                  type="button"
                >
                  Voltar e corrigir
                </button>
                <button
                  className="min-h-11 w-full rounded-full px-4 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                  onClick={onLogout}
                  type="button"
                >
                  Sair
                </button>
              </div>
            </div>
          </div>
        </form>

        {blocker.status === 'blocked' ? (
          <DiscardDialog onDiscard={blocker.proceed} onKeep={blocker.reset} />
        ) : null}
      </>
    )
  }

  return (
    <>
      <form
        className="min-h-svh"
        data-page-canvas="subtle"
        noValidate
        onSubmit={handleReview}
      >
        <header className="finance-safe-top finance-safe-x sticky top-0 z-40 border-b border-line bg-subtle">
          <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 py-2 sm:px-6">
            <button
              className="-ml-2 min-h-11 rounded-full px-3 text-sm font-medium text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              onClick={onLogout}
              type="button"
            >
              Sair
            </button>
            <h1 className="min-w-0 truncate text-base font-semibold tracking-tight text-ink">
              Ponto de partida
            </h1>
            <button
              className="-mr-2 min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
              type="submit"
            >
              Revisar
            </button>
          </div>
        </header>

        <div className="finance-safe-bottom finance-safe-x">
          <div className="mx-auto w-full max-w-2xl space-y-5 px-4 pt-6 sm:px-6">
            <div className="rounded-3xl bg-panel px-4 py-3 ring-1 ring-line/60">
              <p className="text-sm leading-6 text-muted">
                Informe o saldo na abertura de hoje. Lançamentos de hoje entram
                depois dele — o foco é daqui pra frente.
              </p>
            </div>

            {errorCopy ? (
              <div
                className="rounded-3xl border border-coral-ring bg-coral-soft px-4 py-3"
                role="alert"
              >
                <p className="text-sm font-medium text-coral-ink">
                  {errorCopy}
                </p>
              </div>
            ) : null}

            <div>
              <label className="block" htmlFor={`${fieldId}-amount`}>
                <span className="block px-1 pb-2 text-sm font-semibold text-muted">
                  Saldo inicial
                </span>
                <span className="block rounded-3xl bg-panel px-4 py-3 ring-1 ring-line/60 transition focus-within:ring-2 focus-within:ring-accent">
                  <span className="flex items-baseline gap-2 font-mono text-4xl font-semibold tabular-nums">
                    <span aria-hidden="true" className="shrink-0 text-ink">
                      R$
                    </span>
                    <input
                      aria-describedby={
                        errors.amount ? `${fieldId}-amount-error` : undefined
                      }
                      aria-invalid={errors.amount ? true : undefined}
                      aria-label="Saldo inicial"
                      autoComplete="off"
                      className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-faint"
                      id={`${fieldId}-amount`}
                      inputMode="numeric"
                      onChange={(event) =>
                        handleAmountChange(event.target.value)
                      }
                      placeholder="0,00"
                      ref={amountRef}
                      value={formatAmountInputValue(amountDigits)}
                    />
                  </span>
                </span>
              </label>
              {errors.amount ? (
                <p
                  className="px-1 pt-2 text-xs font-medium text-coral-ink"
                  id={`${fieldId}-amount-error`}
                  role="alert"
                >
                  {errors.amount}
                </p>
              ) : null}
            </div>

            <fieldset className="rounded-3xl bg-panel p-4 ring-1 ring-line/60">
              <legend className="px-1 text-sm font-semibold text-muted">
                Como está sua conta nesse dia?
              </legend>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <label
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                    direction === 'available'
                      ? 'border-accent bg-accent text-accent-contrast'
                      : 'border-line bg-subtle text-ink hover:bg-panel'
                  }`}
                >
                  <input
                    checked={direction === 'available'}
                    className="sr-only"
                    name={`${fieldId}-direction`}
                    onChange={() => setDirection('available')}
                    type="radio"
                    value="available"
                  />
                  Disponível
                </label>
                <label
                  className={`flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent ${
                    direction === 'negative'
                      ? 'border-coral bg-coral text-coral-contrast'
                      : 'border-line bg-subtle text-ink hover:bg-panel'
                  }`}
                >
                  <input
                    checked={direction === 'negative'}
                    className="sr-only"
                    name={`${fieldId}-direction`}
                    onChange={() => setDirection('negative')}
                    type="radio"
                    value="negative"
                  />
                  No vermelho
                </label>
              </div>
              <p className="px-1 pt-2 text-xs text-muted">
                Use &quot;No vermelho&quot; para saldo negativo. Zero fica igual
                nos dois.
              </p>
            </fieldset>

            <p className="px-1 text-xs text-muted">
              O ponto de partida pode ser zero, positivo ou negativo. Ele não
              poderá ser alterado nesta versão.
            </p>
          </div>
        </div>
      </form>

      {blocker.status === 'blocked' ? (
        <DiscardDialog onDiscard={blocker.proceed} onKeep={blocker.reset} />
      ) : null}
    </>
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
      className="finance-safe-fixed-dialog fixed z-50 mx-auto max-w-md rounded-3xl border border-line bg-panel p-5 text-left shadow-(--finance-shadow-strong) sm:mx-0"
      open
    >
      <h2 className="text-lg font-semibold text-ink" id="discard-draft-title">
        Descartar ponto de partida?
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
          className="min-h-11 rounded-full bg-coral px-5 text-sm font-semibold text-coral-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral"
          onClick={onDiscard}
          type="button"
        >
          Descartar
        </button>
      </div>
    </dialog>
  )
}
