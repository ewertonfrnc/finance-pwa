import { useEffect, useLayoutEffect, useState } from 'react'

import type { ResolvedAuthSession } from './auth-session'
import { AuthShell } from './auth-shell'

const EXPIRED_CALLBACK_CODES = new Set(['flow_state_expired', 'otp_expired'])

type ConfirmationFailure = 'denied' | 'expired' | 'invalid'

function readCallbackParameters(url: URL) {
  const fragment = new URLSearchParams(url.hash.replace(/^#/, ''))

  return {
    error: fragment.get('error') ?? url.searchParams.get('error'),
    errorCode: fragment.get('error_code') ?? url.searchParams.get('error_code'),
  }
}

function readConfirmationFailure(url: URL): ConfirmationFailure | null {
  const { error, errorCode } = readCallbackParameters(url)

  if (errorCode && EXPIRED_CALLBACK_CODES.has(errorCode)) return 'expired'
  if (error === 'access_denied') return 'denied'
  if (error || errorCode) return 'invalid'

  return null
}

function cleanConfirmationUrl(url: URL) {
  window.history.replaceState(window.history.state, '', url.pathname)
}

type ConfirmPageProps = {
  auth: ResolvedAuthSession
  onConfirmed: () => Promise<void> | void
}

export function ConfirmPage({ auth, onConfirmed }: ConfirmPageProps) {
  const [callbackFailure] = useState(() =>
    readConfirmationFailure(new URL(window.location.href)),
  )
  const confirmationSucceeded =
    callbackFailure === null && auth.status === 'authenticated'

  useLayoutEffect(() => {
    cleanConfirmationUrl(new URL(window.location.href))
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
        className="rounded-3xl border border-coral/45 bg-coral/10 px-5 py-5"
        role="alert"
      >
        <p className="text-sm leading-6 text-ink">
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
