import { useState, type FormEvent } from 'react'

import {
  AUTH_ERROR_COPY,
  getRegistrationErrorCopy,
  isExistingAccountError,
} from './auth-errors'
import { AuthShell } from './auth-shell'
import { registerWithEmail } from './auth-service'

const MINIMUM_PASSWORD_LENGTH = 8

export function RegisterPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirmation, setPasswordConfirmation] = useState('')
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

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

    const normalizedEmail = email.trim()
    setIsPending(true)

    try {
      await registerWithEmail({
        email: normalizedEmail,
        emailRedirectTo: new URL(
          '/auth/confirm',
          window.location.origin,
        ).toString(),
        password,
      })
      setSubmittedEmail(normalizedEmail)
    } catch (error) {
      if (isExistingAccountError(error)) {
        setSubmittedEmail(normalizedEmail)
      } else {
        setErrorCopy(getRegistrationErrorCopy(error))
      }
    } finally {
      setIsPending(false)
    }
  }

  if (submittedEmail) {
    return (
      <AuthShell
        description="Enviamos as instruções de confirmação para o endereço informado."
        eyebrow="Cadastro"
        title="Confira seu email."
      >
        <output className="block rounded-3xl border border-success/40 bg-success/10 px-5 py-5">
          <p className="font-semibold text-ink">{submittedEmail}</p>
          <p className="mt-2 text-sm leading-6 text-muted">
            Abra o link recebido para confirmar a conta e continuar.
          </p>
        </output>
        <a
          className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full border border-line bg-canvas px-6 font-semibold text-ink transition hover:border-accent-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          href="/login"
        >
          Voltar para o login
        </a>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      description="Cadastre seu email e escolha uma senha para começar."
      eyebrow="Cadastro"
      title="Crie sua conta."
    >
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
          <label className="text-sm font-semibold text-ink" htmlFor="password">
            Senha
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
            Confirme a senha
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
          {isPending ? 'Criando conta...' : 'Criar conta'}
        </button>

        <p className="text-center text-sm text-muted">
          Já tem uma conta?{' '}
          <a
            className="inline-flex min-h-11 min-w-11 items-center justify-center font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/login"
          >
            Entrar
          </a>
        </p>
      </form>
    </AuthShell>
  )
}
