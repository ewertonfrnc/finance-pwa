# Authentication contract

Status: delivered locally; hosted recovery verified, confirmation pending; starting-position gate delivered locally on 2026-08-28

Last reviewed: 2026-08-28

## Scope

The application uses Supabase Auth with email and password. Registration,
email confirmation, login, local logout, and password recovery are in scope.
OAuth, magic links, phone authentication, MFA, profiles, account deletion, and
financial onboarding are not.

Supabase requires email confirmation and passwords of at least eight
characters in every environment. The browser keeps the `supabase-js` defaults
for session persistence, automatic token refresh, and session detection in
confirmation and recovery URLs.

## Route contract

| Route                    | Access                           | Result                                                                                                             |
| ------------------------ | -------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `/login`                 | Public-only                      | Signs in and opens a validated internal destination, `/onboarding`, or `/app` depending on the starting position.  |
| `/register`              | Public-only                      | Creates an unconfirmed account and asks the visitor to check their email.                                          |
| `/forgot-password`       | Public-only                      | Shows the same completion message for every well-formed email address.                                             |
| `/auth/confirm`          | Public callback                  | Consumes email confirmation, removes sensitive URL data, then opens `/onboarding` or `/app` or a safe retry state. |
| `/auth/update-password`  | Recovery callback                | Accepts a new password only while a valid recovery session exists.                                                 |
| `/onboarding`            | Authenticated without a position | Shows the entry/review/confirm flow for the opening balance and a logout action.                                   |
| `/onboarding`            | Authenticated with a position    | Replaces the URL with `/app?month=YYYY-MM`. Never flashes the form.                                                |
| `/app`                   | Authenticated with a position    | Shows the workspace with the month navigation and the `Ponto de partida` action.                                   |
| `/app/starting-position` | Authenticated with a position    | Shows the saved `R$` value, `effective_on` (long + `YYYY-MM-DD`), opening semantics, and immutable copy.           |
| Any positioned route     | Authenticated without a position | Replaces the URL with `/onboarding` before any transaction request runs.                                           |

An authenticated user who opens `/login` or `/register` goes to `/app` when a
starting position exists and to `/onboarding` otherwise. The home route and
`/offline` remain available in every auth state. A password-recovery session
still cannot open any private route and is sent to `/auth/update-password`.

## Auth state and authorization

The session context has three observable states: resolving, anonymous, and
authenticated. The application waits for the first Supabase Auth event before
mounting the router. This prevents a stored session from flashing the login
page and prevents private content from rendering before an anonymous redirect.

TanStack Router receives the resolved state through its router context. A
pathless `_authenticated` route protects every private path in `beforeLoad`.
`_authenticated._positioned` is a second pathless guard that fetches
`['starting-position', userId]` with `staleTime: 'static'` for a saved row and
`0` for `null`; a `null` row redirects to `/onboarding`, a rejected read
renders the retry/logout error state, and a row is returned in route context.
`_authenticated.onboarding` does the inverse and redirects to `/app` when a row
already exists. These are UI boundaries only. PostgreSQL grants and RLS remain
the authorization boundary for financial data.

The session stays in React context, not Zustand or TanStack Query. When the
authenticated user ID changes or becomes anonymous, the application clears the
TanStack Query cache before data for the next identity can render.

Ordinary logout uses `signOut({ scope: 'local' })`, so sessions on other
devices remain valid. A successful password replacement uses global sign-out
to revoke every refresh token for the user, then returns to login with a
success message.

Password recovery stores only the recovery user ID in browser storage. This
keeps recovery mode after a reload without persisting a token or callback URL.
An anonymous event or a different authenticated user removes the marker.

## Redirect and callback rules

Confirmation and recovery destinations come from `window.location.origin`.
Local development, Playwright, Deploy Previews, and production therefore
return to the origin that initiated the request.

The `redirect` query parameter after login must start with one `/`, resolve to
the current origin, and contain no backslash. The application rejects absolute
URLs, protocol-relative URLs, malformed values, and paths that resolve to
another origin. A rejected or missing value falls back to `/app`.

Supabase may return callback session data or a provider error in the query or
URL fragment. `supabase-js` consumes supported session data, then the callback
replaces browser history with a clean application URL before it renders a
result. UI copy and logs must never contain an access token, refresh token,
password, confirmation link, recovery link, provider message, or raw callback
URL.

## Error contract

Application copy is selected by `error.code`. It must never match or display a
Supabase error message. Unknown codes use a generic retry message.

| Operation                         | Supabase codes                                                                                  | Public result                                                 |
| --------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Login                             | `invalid_credentials`, `email_not_confirmed`, `user_banned`                                     | `Email ou senha inválidos`                                    |
| Password validation               | `weak_password`, `validation_failed`                                                            | Explain the eight-character minimum without provider text.    |
| Email delivery                    | `over_email_send_rate_limit`, `over_request_rate_limit`                                         | Ask the visitor to wait and retry.                            |
| Confirmation or recovery callback | `otp_expired`, `flow_state_expired`, `flow_state_not_found`, `bad_code_verifier`                | Show an expired or invalid-link state with a safe retry path. |
| Session                           | `refresh_token_not_found`, `refresh_token_already_used`, `session_expired`, `session_not_found` | Clear local auth state and return to login.                   |
| Provider or network failure       | Any other code or client error                                                                  | Show a generic failure and keep secrets out of logs.          |

Registration completion does not reveal whether an address already exists.
Password recovery returns the same completion state for existing and unknown
well-formed addresses. A rate-limit state may ask the visitor to wait, but it
must not state whether the account exists.

## Environment contract

| Context                      | Supabase project                            | Allowed Auth destination                                                   |
| ---------------------------- | ------------------------------------------- | -------------------------------------------------------------------------- |
| Local Vite                   | Local CLI stack                             | `http://127.0.0.1:5173/**` and `http://localhost:5173/**`                  |
| Local preview and Playwright | Local CLI stack                             | `http://127.0.0.1:4173/**`                                                 |
| Netlify Deploy Preview       | `finance-pwa-dev` (`qmyfgttdhswjvxliedcc`)  | `https://**--finance-pwa-prod.netlify.app/**`                              |
| Netlify production           | `finance-pwa-prod` (`nosbuwfgfwvixamkgbpy`) | Exact production `/auth/confirm` and `/auth/update-password` callback URLs |

Netlify defines `VITE_SUPABASE_URL` and
`VITE_SUPABASE_PUBLISHABLE_KEY` with different contextual values. Production
targets `finance-pwa-prod`; Deploy Previews and other hosted non-production
contexts target `finance-pwa-dev`. The Netlify Free plan exposes these public
browser values to all scopes, and neither value is marked as secret. No
Supabase secret or `service_role` key is stored in Netlify.

The local E2E launcher reads its values from `supabase status --output json`.
It sends only the local API URL and publishable key to the Vite build. The
service role key stays in the Node test processes and the Playwright web server
receives an empty value. Auth administration and Mailpit helpers reject every
non-loopback URL before creating a client or making a request.

The hosted Auth settings were configured on 2026-08-25. Both projects require
email confirmation, accept new email users, reject anonymous sign-ins, require
eight password characters, and add no composition rule. `finance-pwa-dev`
uses `http://localhost:5173` as its safe fallback Site URL and accepts the
Netlify preview pattern. `finance-pwa-prod` uses
`https://finance-pwa-prod.netlify.app` as its Site URL and allows only the
exact confirmation and recovery callback URLs for that origin.

The hosted default mailer is acceptable for the approved smoke test. Custom
SMTP remains required before external users are invited because the default
mailer is rate-limited and best-effort.

Creating or changing a hosted Supabase project, Netlify environment variables,
Auth settings, SMTP, or deployment requires explicit authorization.

## Verification boundary

The local stack must expose the Auth health endpoint and Mailpit API before
Playwright begins. The E2E helper can create and delete test accounts through
the local Admin API and can retrieve confirmation and recovery messages by
recipient through Mailpit. Neither helper can target a hosted service.

CI starts the full local Supabase stack, resets and tests the database, runs
browser tests through the local launcher, and stops the stack in an `always`
cleanup step.

The complete local delivery gate passed on 2026-08-28. A clean database reset
applied the four migrations and seed, all 77 pgTAP checks passed, generated
database types stayed unchanged, and static checks, TypeScript, 292 Vitest
tests, and the PWA production build (50 precached) passed. All 56 Playwright
cases passed in `mobile-chromium` (`375×667`) and `desktop-chromium`
(`1280×800`) against real local GoTrue and Mailpit services. Those browser
cases cover registration, confirmation, login, onboarding (new-user
registration → onboarding → workspace, redirect of financial routes without a
position, bypass for returning users, idempotent retry, offline/retry without
trap, resume after leaving, and the `23505` already-saved detail), reload,
logout, recovery reload and route isolation, new-password login, home, offline,
not-found recovery, manifest, and service-worker registration.

Pull request #4 received the distinct preview
`https://deploy-preview-4--finance-pwa-prod.netlify.app`. A recovery smoke on
2026-08-25 directly observed a `200` response from
`qmyfgttdhswjvxliedcc.supabase.co/auth/v1/recover`, with `redirect_to` set to
the same preview origin at `/auth/update-password`. This proves that the
preview artifact uses `finance-pwa-dev` for recovery and does not contact the
production project in that flow.

The browser console contained only four `ERR_BLOCKED_BY_CLIENT` failures for
Netlify Deploy Preview toolbar telemetry sent to Segment and Bugsnag. Helium
blocked those third-party requests; they were not application or Supabase
errors and contained no application credential. Account confirmation on the
preview, anonymous RLS denial, and the final Netlify log review remain before
the hosted verification is complete.

## References

- [Supabase CLI local configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [Mailpit API v1](https://mailpit.axllent.org/docs/api-v1/)
