import { useEffect, useId, useRef } from 'react'

import { formatAmountCents } from './transaction-money'
import type { Transaction } from './transaction-types'

type DeleteTransactionDialogProps = {
  errorCopy: string | null
  hasConflict: boolean
  isOnline: boolean
  isPending: boolean
  onCancel: () => void
  onConfirm: () => void
  onConflictReload: () => void
  open: boolean
  transaction: Transaction
}

const KIND_LABEL: Record<string, string> = {
  expense: 'Saída',
  income: 'Entrada',
}

export function DeleteTransactionDialog({
  errorCopy,
  hasConflict,
  isOnline,
  isPending,
  onCancel,
  onConfirm,
  onConflictReload,
  open,
  transaction,
}: DeleteTransactionDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const errorId = useId()
  const pendingFootnoteId = useId()
  const overlayRef = useRef<HTMLDivElement>(null)
  const cancelRef = useRef<HTMLButtonElement>(null)

  const description =
    transaction.description ??
    `${KIND_LABEL[transaction.kind] ?? transaction.kind} sem descrição`
  const amount = formatAmountCents(transaction.amount_cents)

  // Focus the cancel control when the dialog opens so keyboard users land on the safe action.
  useEffect(() => {
    if (open) cancelRef.current?.focus()
  }, [open])

  useEffect(() => {
    if (!open) return

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isPending) onCancel()
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isPending, onCancel, open])

  if (!open) return null

  // Never expose id, user_id, created_at, or updated_at. Only the user-visible description, amount, and kind.
  const confirmFootnote = !isOnline
    ? 'Sem conexão. Conecte-se para excluir.'
    : isPending
      ? 'Excluindo e atualizando o mês...'
      : null

  return (
    <div
      aria-hidden={!open}
      className="fixed inset-0 z-50 flex items-end justify-center bg-ink/40 p-4 sm:items-center"
      onClick={(event) => {
        if (event.target === overlayRef.current && !isPending) onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && !isPending) onCancel()
      }}
      ref={overlayRef}
      role="presentation"
    >
      <dialog
        aria-describedby={descriptionId}
        aria-labelledby={titleId}
        className="finance-safe-bottom m-0 w-full max-w-md rounded-3xl border border-line bg-panel p-5 shadow-(--finance-shadow-strong) sm:rounded-4xl sm:p-6"
        open
      >
        <h2 className="text-lg font-semibold text-ink" id={titleId}>
          Excluir lançamento?
        </h2>

        <p className="mt-2 text-sm leading-6 text-muted" id={descriptionId}>
          {description} ·{' '}
          <span className="font-mono font-medium tabular-nums">{amount}</span>
        </p>

        <p className="mt-1 text-sm leading-6 text-muted">
          Essa ação não pode ser desfeita.
        </p>

        {errorCopy ? (
          <div
            className="mt-4 rounded-3xl border border-coral-ring bg-coral-soft px-4 py-3"
            id={errorId}
            role="alert"
          >
            <p className="text-sm font-medium text-coral-ink">{errorCopy}</p>

            {hasConflict ? (
              <button
                className="mt-3 min-h-11 rounded-full bg-ink px-4 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                onClick={onConflictReload}
                type="button"
              >
                Recarregar lançamento
              </button>
            ) : null}
          </div>
        ) : null}

        {confirmFootnote ? (
          <p
            className="mt-4 text-xs font-medium text-muted"
            id={pendingFootnoteId}
          >
            {confirmFootnote}
          </p>
        ) : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            aria-describedby={confirmFootnote ? pendingFootnoteId : undefined}
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-45"
            disabled={isPending}
            onClick={onCancel}
            ref={cancelRef}
            type="button"
          >
            Cancelar
          </button>

          <button
            aria-describedby={confirmFootnote ? pendingFootnoteId : undefined}
            className="min-h-11 rounded-full bg-coral px-5 text-sm font-semibold text-coral-contrast transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-coral disabled:cursor-not-allowed disabled:opacity-45"
            disabled={!isOnline || isPending}
            onClick={onConfirm}
            type="button"
          >
            {isPending ? 'Excluindo...' : 'Excluir'}
          </button>
        </div>
      </dialog>
    </div>
  )
}
