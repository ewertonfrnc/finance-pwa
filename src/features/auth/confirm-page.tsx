import { useEffect, useLayoutEffect, useState } from 'react'

import { cleanAuthCallbackUrl, readAuthCallbackFailure } from './auth-callback'
import type { ResolvedAuthSession } from './auth-session'
import { AuthShell } from './auth-shell'

type ConfirmPageProps = {
  auth: ResolvedAuthSession
  onConfirmed: () => Promise<void> | void
}

export function ConfirmPage({ auth, onConfirmed }: ConfirmPageProps) {
  const [callbackFailure] = useState(() =>
    readAuthCallbackFailure(new URL(window.location.href)),
  )
  const confirmationSucceeded =
    callbackFailure === null &&
    auth.status === 'authenticated' &&
    !auth.isPasswordRecovery

  useLayoutEffect(() => {
    cleanAuthCallbackUrl(new URL(window.location.href))
  }, [])

  useEffect(() => {
    if (confirmationSucceeded) void onConfirmed()
  }, [confirmationSucceeded, onConfirmed])

  if (confirmationSucceeded) {
    return (
      <AuthShell
        description="Seu email foi confirmado. Estamos abrindo sua conta."
        eyebrow="Confirmação"
        title="Email confirmado."
      >
        <output className="block rounded-3xl border border-success/40 bg-success/10 px-5 py-5 text-sm font-medium text-ink">
          Carregando sua conta...
        </output>
      </AuthShell>
    )
  }

  const failure = callbackFailure ?? 'invalid'
  const content = {
    denied: {
      description:
        'A confirmação foi recusada. Volte ao cadastro para tentar novamente.',
      title: 'Não foi possível confirmar.',
    },
    expired: {
      description:
        'Este link não é mais válido. Volte ao cadastro para receber um novo email.',
      title: 'Este link expirou.',
    },
    invalid: {
      description:
        'Este endereço de confirmação é inválido ou já foi usado. Volte ao cadastro para tentar novamente.',
      title: 'Link de confirmação inválido.',
    },
  }[failure]

  return (
    <AuthShell
      description={content.description}
      eyebrow="Confirmação"
      title={content.title}
    >
      <div
        className="rounded-3xl border border-coral-ring bg-coral-soft px-5 py-5"
        role="alert"
      >
        <p className="text-sm leading-6 text-coral-ink">
          Nenhum dado da conta foi alterado.
        </p>
      </div>
      <a
        className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas shadow-(--finance-shadow-button) transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        href="/register"
      >
        Voltar ao cadastro
      </a>
    </AuthShell>
  )
}
