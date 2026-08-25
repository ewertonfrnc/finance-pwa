# Authentication contract

Status: delivered locally; hosted verification in progress

Last reviewed: 2026-08-25

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

| Route                   | Access            | Result                                                                                            |
| ----------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `/login`                | Public-only       | Signs in and opens a validated internal destination or `/app`.                                    |
| `/register`             | Public-only       | Creates an unconfirmed account and asks the visitor to check their email.                         |
| `/forgot-password`      | Public-only       | Shows the same completion message for every well-formed email address.                            |
| `/auth/confirm`         | Public callback   | Consumes email confirmation, removes sensitive URL data, then opens `/app` or a safe retry state. |
| `/auth/update-password` | Recovery callback | Accepts a new password only while a valid recovery session exists.                                |
| `/app`                  | Authenticated     | Shows the authenticated placeholder and a logout action.                                          |

An authenticated user who opens `/login` or `/register` goes to `/app`. The
home route and `/offline` remain available in every auth state.

## Auth state and authorization

The session context has three observable states: resolving, anonymous, and
authenticated. The application waits for the first Supabase Auth event before
mounting the router. This prevents a stored session from flashing the login
page and prevents private content from rendering before an anonymous redirect.

TanStack Router receives the resolved state through its router context. A
pathless `_authenticated` route protects `/app` in `beforeLoad`. This is a UI
boundary only. PostgreSQL grants and RLS remain the authorization boundary for
financial data.

The session stays in React context, not Zustand or TanStack Query. When the
authenticated user ID changes or becomes anonymous, the application clears the
TanStack Query cache before data for the next identity can render.

Ordinary logout uses `signOut({ scope: 'local' })`, so sessions on other
devices remain valid. A successful password replacement uses global sign-out
to revoke every refresh token for the user, then returns to login with a
success message.

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

The complete local delivery gate passed on 2026-08-25. A clean database reset
applied the versioned migration and seed, all 19 pgTAP checks passed, generated
database types stayed unchanged, and static checks, TypeScript, 84 Vitest
tests, and the PWA production build passed. All 18 Playwright cases passed in
mobile and desktop Chromium against real local GoTrue and Mailpit services.
Those browser cases cover registration, confirmation, login, reload, logout,
recovery, new-password login, home, offline, not-found recovery, manifest, and
service-worker registration.

Dashboard evidence confirms that hosted projects and redirect allow-lists are
separate. The remaining hosted proof is a real Deploy Preview registration and
recovery smoke that stays on its own origin and sends every Auth request to
`finance-pwa-dev`. Pull request #4 received the distinct preview
`https://deploy-preview-4--finance-pwa-prod.netlify.app`. Do not treat a ready
deployment or configuration screenshots as runtime proof.

## References

- [Supabase CLI local configuration](https://supabase.com/docs/guides/local-development/cli/config)
- [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [Mailpit API v1](https://mailpit.axllent.org/docs/api-v1/)
