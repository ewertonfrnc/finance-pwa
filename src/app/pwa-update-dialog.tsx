type PwaUpdateDialogProps = {
  kind: 'offline-ready' | 'update'
  onAccept: () => void
  onDismiss: () => void
}

export function PwaUpdateDialog({
  kind,
  onAccept,
  onDismiss,
}: PwaUpdateDialogProps) {
  const isUpdate = kind === 'update'
  const titleId = `pwa-${kind}-title`
  const descriptionId = `pwa-${kind}-description`

  return (
    <dialog
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-md rounded-3xl border border-line bg-panel p-5 text-left shadow-(--finance-shadow-strong) sm:inset-x-auto sm:right-6 sm:bottom-6 sm:mx-0"
      open
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-2xl bg-accent-soft text-ink"
        >
          {isUpdate ? <RefreshIcon /> : <CheckIcon />}
        </span>

        <div>
          <h2 className="text-lg font-semibold text-ink" id={titleId}>
            {isUpdate
              ? 'Nova versão disponível'
              : 'App pronto para abrir offline'}
          </h2>
          <p className="mt-1 text-sm leading-6 text-muted" id={descriptionId}>
            {isUpdate
              ? 'Atualize quando terminar o que está fazendo. A página só recarrega com a sua confirmação.'
              : 'A estrutura do app pode abrir sem conexão. Dados financeiros continuam dependendo de internet.'}
          </p>
        </div>
      </div>

      <div className="mt-4 flex justify-end gap-2">
        {isUpdate ? (
          <button
            className="min-h-11 rounded-full px-4 text-sm font-semibold text-muted transition hover:bg-subtle hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            onClick={onDismiss}
            type="button"
          >
            Depois
          </button>
        ) : null}
        <button
          className="min-h-11 rounded-full bg-ink px-5 text-sm font-semibold text-canvas transition hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          onClick={onAccept}
          type="button"
        >
          {isUpdate ? 'Atualizar agora' : 'Entendi'}
        </button>
      </div>
    </dialog>
  )
}

function RefreshIcon() {
  return (
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="M19 8a7 7 0 1 0 .5 7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
      <path
        d="M19 4v4h-4"
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
    <svg aria-hidden="true" className="size-5" fill="none" viewBox="0 0 24 24">
      <path
        d="m7 12 3 3 7-7"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.8"
      />
    </svg>
  )
}
