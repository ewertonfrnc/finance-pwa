import { useState, type FormEvent } from 'react'

import { AUTH_ERROR_COPY, getLoginErrorCopy } from './auth-errors'
import { AuthShell } from './auth-shell'
import { signInWithEmail } from './auth-service'

const DEFAULT_LOGIN_DESTINATION = '/app'

export function resolveLoginDestination(
  requestedDestination: unknown,
  origin = window.location.origin,
) {
  if (
    typeof requestedDestination !== 'string' ||
    !requestedDestination.startsWith('/') ||
    requestedDestination.startsWith('//') ||
    requestedDestination.includes('\\')
  ) {
    return DEFAULT_LOGIN_DESTINATION
  }

  try {
    const destination = new URL(requestedDestination, origin)

    if (destination.origin !== origin) return DEFAULT_LOGIN_DESTINATION

    return `${destination.pathname}${destination.search}${destination.hash}`
  } catch {
    return DEFAULT_LOGIN_DESTINATION
  }
}

type LoginPageProps = {
  notice?: 'password-updated'
  onSignedIn: (destination: string) => Promise<void> | void
  redirect?: unknown
}

export function LoginPage({ notice, onSignedIn, redirect }: LoginPageProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCopy(null)
    setIsPending(true)

    try {
      await signInWithEmail({ email: email.trim(), password })
      await onSignedIn(resolveLoginDestination(redirect))
    } catch (error) {
      setErrorCopy(getLoginErrorCopy(error))
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AuthShell
      description="Use o email e a senha da sua conta para continuar."
      eyebrow="Acesso"
      title="Entre na sua conta."
    >
      {notice === 'password-updated' ? (
        <output className="mb-5 block rounded-2xl border border-success/40 bg-success/10 px-4 py-3 text-sm font-medium text-ink">
          {AUTH_ERROR_COPY.passwordUpdated}
        </output>
      ) : null}
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div>
          <label className="text-sm font-semibold text-ink" htmlFor="email">
            Email
          </label>
          <input
            autoComplete="email"
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-base text-ink outline-none transition placeholder:text-muted/65 focus:border-accent-ink focus:ring-3 focus:ring-accent/35"
            disabled={isPending}
            id="email"
            inputMode="email"
            name="email"
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
            required
            type="email"
            value={email}
          />
        </div>

        <div>
          <div className="flex items-center justify-between gap-4">
            <label
              className="text-sm font-semibold text-ink"
              htmlFor="password"
            >
              Senha
            </label>
            <a
              className="text-sm font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              href="/forgot-password"
            >
              Esqueci minha senha
            </a>
          </div>
          <input
            autoComplete="current-password"
            className="mt-2 min-h-12 w-full rounded-2xl border border-line bg-canvas px-4 text-base text-ink outline-none transition focus:border-accent-ink focus:ring-3 focus:ring-accent/35"
            disabled={isPending}
            id="password"
            name="password"
            onChange={(event) => setPassword(event.target.value)}
            required
            type="password"
            value={password}
          />
        </div>

        {errorCopy ? (
          <p
            className="rounded-2xl border border-coral/45 bg-coral/10 px-4 py-3 text-sm font-medium text-ink"
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
          {isPending ? 'Entrando...' : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
