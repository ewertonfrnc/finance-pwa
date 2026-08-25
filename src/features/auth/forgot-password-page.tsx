import { useState, type FormEvent } from 'react'

import { getPasswordRecoveryErrorCopy } from './auth-errors'
import { AuthShell } from './auth-shell'
import { requestPasswordRecovery } from './auth-service'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [requestCompleted, setRequestCompleted] = useState(false)
  const [errorCopy, setErrorCopy] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setErrorCopy(null)
    setIsPending(true)

    try {
      await requestPasswordRecovery({
        email: email.trim(),
        redirectTo: new URL(
          '/auth/update-password',
          window.location.origin,
        ).toString(),
      })
      setRequestCompleted(true)
    } catch (error) {
      setErrorCopy(getPasswordRecoveryErrorCopy(error))
    } finally {
      setIsPending(false)
    }
  }

  if (requestCompleted) {
    return (
      <AuthShell
        description="Enviamos as instruções quando encontramos uma conta com o email informado."
        eyebrow="Recuperação"
        title="Confira seu email."
      >
        <output className="block rounded-3xl border border-success/40 bg-success/10 px-5 py-5 text-sm leading-6 text-ink">
          Se houver uma conta com esse email, você receberá um link para criar
          uma nova senha.
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
      description="Informe o email da sua conta para receber um link de recuperação."
      eyebrow="Recuperação"
      title="Recupere seu acesso."
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
          {isPending ? 'Enviando...' : 'Enviar link de recuperação'}
        </button>

        <p className="text-center text-sm text-muted">
          Lembrou sua senha?{' '}
          <a
            className="font-semibold text-ink underline decoration-line decoration-2 underline-offset-4 focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            href="/login"
          >
            Entrar
          </a>
        </p>
      </form>
    </AuthShell>
  )
}
