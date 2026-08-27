import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'

import {
  cleanAuthCallbackUrl,
  isPasswordRecoveryCallback,
  readAuthCallbackFailure,
} from './auth-callback'
import { AUTH_ERROR_COPY, getPasswordUpdateErrorCopy } from './auth-errors'
import type { ResolvedAuthSession } from './auth-session'
import { AuthShell } from './auth-shell'
import { signOutGlobally, updatePassword } from './auth-service'

const MINIMUM_PASSWORD_LENGTH = 8
const RECOVERY_EVENT_TIMEOUT_MS = 1_000

type UpdatePasswordPageProps = {
  auth: ResolvedAuthSession
  onPasswordUpdated: () => Promise<void> | void
}

export function UpdatePasswordPage({
  auth,
  onPasswordUpdated,
}: UpdatePasswordPageProps) {
  const [callback] = useState(() => {
    const url = new URL(window.location.href)

    return {
      failure: readAuthCallbackFailure(url),
      isPasswordRecovery: isPasswordRecoveryCallback(url),
    }
  })
  const [recoveryEventTimedOut, setRecoveryEventTimedOut] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)
  const [passwordWasUpdated, setPasswordWasUpdated] = useState(false)
  const [completionFailed, setCompletionFailed] = useState(false)
  const hasRecoverySession =
    auth.status === 'authenticated' && auth.isPasswordRecovery
  const isWaitingForRecoveryEvent =
    callback.failure === null &&
    callback.isPasswordRecovery &&
    !hasRecoverySession &&
    !recoveryEventTimedOut

  useLayoutEffect(() => {
    cleanAuthCallbackUrl(new URL(window.location.href))
  }, [])

  useEffect(() => {
    if (!isWaitingForRecoveryEvent) return

    const timeout = window.setTimeout(
      () => setRecoveryEventTimedOut(true),
      RECOVERY_EVENT_TIMEOUT_MS,
    )

    return () => window.clearTimeout(timeout)
  }, [isWaitingForRecoveryEvent])

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCopy(null)

    if (password.length < MINIMUM_PASSWORD_LENGTH) {
      setErrorCopy(AUTH_ERROR_COPY.weakPassword)
      return
    }

    if (password !== passwordConfirmation) {
      setErrorCopy(AUTH_ERROR_COPY.passwordMismatch)
      return
    }

    setIsPending(true)

    try {
      await updatePassword(password)
      setPasswordWasUpdated(true)

      try {
        await signOutGlobally()
      } catch {
        setCompletionFailed(true)
        return
      }

      await onPasswordUpdated()
    } catch (error) {
      setErrorCopy(getPasswordUpdateErrorCopy(error))
    } finally {
      setIsPending(false)
    }
  }

  if (passwordWasUpdated) {
    return (
      <AuthShell
        description={
          completionFailed
            ? 'Sua senha mudou, mas não conseguimos encerrar todas as sessões.'
            : 'Estamos encerrando suas sessões antes de voltar ao login.'
        }
        eyebrow="Recuperação"
        title={completionFailed ? 'Senha alterada.' : 'Finalizando...'}
      >
        {completionFailed ? (
          <>
            <p
              className="rounded-2xl border border-coral-ring bg-coral-soft px-4 py-3 text-sm font-medium leading-6 text-coral-ink"
              role="alert"
            >
              Entre novamente. Se outra sessão continuar aberta, encerre-a no
              próprio dispositivo.
            </p>
            <a
              className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas shadow-(--finance-shadow-button) transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href="/login"
            >
              Voltar para o login
            </a>
          </>
        ) : (
          <output className="block rounded-3xl border border-success/40 bg-success/10 px-5 py-5 text-sm font-medium text-ink">
            Senha alterada. Redirecionando...
          </output>
        )}
      </AuthShell>
    )
  }

  if (isWaitingForRecoveryEvent) {
    return (
      <AuthShell
        description="Estamos verificando se este link ainda pode ser usado."
        eyebrow="Recuperação"
        title="Validando seu link."
      >
        <output className="block rounded-3xl border border-line bg-subtle px-5 py-5 text-sm font-medium text-ink">
          Aguarde um instante...
        </output>
      </AuthShell>
    )
  }

  if (callback.failure !== null || !hasRecoverySession) {
    const linkExpired = callback.failure === 'expired'

    return (
      <AuthShell
        description={
          linkExpired
            ? 'Este link não é mais válido. Solicite um novo email para continuar.'
            : 'Este endereço de recuperação é inválido ou já foi usado.'
        }
        eyebrow="Recuperação"
        title={
          linkExpired ? 'Este link expirou.' : 'Link de recuperação inválido.'
        }
      >
        <div
          className="rounded-3xl border border-coral-ring bg-coral-soft px-5 py-5"
          role="alert"
        >
          <p className="text-sm leading-6 text-coral-ink">
            Nenhuma senha foi alterada.
          </p>
        </div>
        <a
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas shadow-(--finance-shadow-button) transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/forgot-password"
        >
          Solicitar outro link
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Escolha uma senha diferente da anterior para voltar à sua conta."
      eyebrow="Recuperação"
      title="Crie uma nova senha."
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="password">
            Nova senha
          </label>
          <input
            aria-describedby="password-requirement"
            autoComplete="new-password"
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-base text-ink outline-none transition focus:border-accent-ink focus:ring-3 focus:ring-accent/35"
            disabled={isPending}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
          <p className="mt-2 text-sm text-muted" id="password-requirement">
            Use pelo menos 8 caracteres.
          </p>
        </div>

        <div>
          <label
            className="text-sm font-semibold text-ink"
            htmlFor="password-confirmation"
          >
            Confirme a nova senha
          </label>
          <input
            autoComplete="new-password"
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-base text-ink outline-none transition focus:border-accent-ink focus:ring-3 focus:ring-accent/35"
            disabled={isPending}
            id="password-confirmation"
            name="passwordConfirmation"
            onChange={(event) => setPasswordConfirmation(event.target.value)}
            required
            type="password"
            value={passwordConfirmation}
          />
        </div>

        {errorCopy ? (
          <p
            className="rounded-2xl border border-coral-ring bg-coral-soft px-4 py-3 text-sm font-medium text-coral-ink"
            role="alert"
          >
            {errorCopy}
          </p>
        ) : null}

        <button
          className="inline-flex min-h-12 w-full items-center justify-center rounded-full bg-ink px-6 font-semibold text-canvas shadow-(--finance-shadow-button) transition hover:-translate-y-0.5 hover:bg-ink-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-wait disabled:opacity-65 disabled:hover:translate-y-0"
          disabled={isPending}
          type="submit"
        >
          {isPending ? 'Alterando senha...' : 'Alterar senha'}
        </button>
      </form>
    </AuthShell>
  )
}
