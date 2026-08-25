# Authentication flow implementation plan

Status: in progress

Last reviewed: 2026-08-25

Roadmap step: 3

Branch: `feat/authentication`

## Outcome

Deliver email-and-password authentication backed by Supabase Auth. A visitor
can create and confirm an account, sign in, keep the session after a reload,
open `/app`, sign out, and replace a forgotten password.

This step stops at an authenticated placeholder. Collecting the starting
financial position belongs to the next feature.

## Decisions

- Support email and password only. OAuth, magic links, phone authentication,
  MFA, profiles, account deletion, and financial onboarding stay out of scope.
- Require email confirmation in local, preview, and production environments.
- Require at least eight password characters. Do not add composition rules or
  a password-strength package in this step.
- Keep the browser defaults from `supabase-js`: persist the session, refresh it
  automatically, and detect sessions in confirmation and recovery URLs.
- Model the current session in a React context. Do not add Zustand or duplicate
  the session in TanStack Query.
- Pass the resolved auth state through TanStack Router context. A pathless
  `_authenticated` route protects `/app` with `beforeLoad`.
- Treat route protection as a UI boundary. PostgreSQL grants and RLS remain the
  authorization boundary for financial data.
- Wait for the initial Supabase auth event before mounting the router. A stored
  session must not flash the login page, and an anonymous visitor must not see
  private content before the redirect.
- Clear TanStack Query when the authenticated user changes or signs out. Data
  cached for one user must never render for the next user on the same browser.
- Use `signOut({ scope: 'local' })` for an ordinary logout so another device
  stays signed in. After a password replacement, use global sign-out to revoke
  every refresh token for that user.
- Accept a post-login `redirect` only when it is a same-origin application
  path. Reject absolute URLs, protocol-relative URLs, and malformed values.
- Map Supabase failures by `error.code`, never by matching English error
  messages. Login and password-recovery copy must not reveal whether an email
  exists.
- After a successful password replacement, sign out and send the user to login
  with a success message. This makes the new password the only way back in.
- Derive confirmation and recovery destinations from `window.location.origin`
  so a Netlify Deploy Preview returns to its own URL.
- Do not cache Auth requests or responses in the service worker. Existing PWA
  runtime caching remains empty.

## Route contract

| Route                   | Access            | Observable behavior                                                                                   |
| ----------------------- | ----------------- | ----------------------------------------------------------------------------------------------------- |
| `/login`                | Public-only       | Signs in and returns to a validated internal destination or `/app`.                                   |
| `/register`             | Public-only       | Creates an unconfirmed account and asks the user to check their email.                                |
| `/forgot-password`      | Public-only       | Always shows the same completion message for a valid email shape.                                     |
| `/auth/confirm`         | Public callback   | Consumes a confirmation result, removes sensitive URL data, and opens `/app` or shows a safe failure. |
| `/auth/update-password` | Recovery callback | Accepts a new password only during a valid recovery session.                                          |
| `/app`                  | Authenticated     | Shows the signed-in placeholder and offers logout.                                                    |

An authenticated user who opens `/login` or `/register` goes to `/app`. The
public home and `/offline` remain accessible in every auth state.

## Environment contract

| Context                      | Supabase project            | Allowed Auth destination                                          |
| ---------------------------- | --------------------------- | ----------------------------------------------------------------- |
| Local Vite                   | Local CLI stack             | `http://127.0.0.1:5173/**` and `http://localhost:5173/**`         |
| Local preview and Playwright | Local CLI stack             | `http://127.0.0.1:4173/**`                                        |
| Netlify Deploy Preview       | `finance-pwa-dev`           | `https://**--finance-pwa-prod.netlify.app/**`                     |
| Netlify production           | Production Supabase project | Exact production `/auth/confirm` and `/auth/update-password` URLs |

Deploy Previews must use Netlify's `deploy-preview` environment variables and
must never receive the production Supabase URL or publishable key. Supabase's
hosted default mailer is acceptable for a limited smoke test. A custom SMTP
provider remains a blocker for inviting external users because the default
mailer is rate-limited and best-effort.

Creating or configuring a cloud project, changing Netlify variables, pushing
Supabase Auth configuration, opening a pull request, and deploying all require
explicit user authorization during execution.

The validation blocks below assume the local Supabase stack was stopped. Check
`bunx supabase status` first. If it was already running, restart it after Auth
configuration changes and leave it running when validation ends. Otherwise,
stop the stack started by the step.

## Delivery steps

The branch keeps the commits below during development. The pull request is
squashed into `feat: add user authentication` when every gate passes.

### 1. Prepare the local Auth contract and test boundary

Status: completed on 2026-08-25

Change:

- update `supabase/config.toml` to require confirmation, enforce the eight
  character minimum, allow the Vite and Playwright callback URLs, and raise the
  local email rate limit enough for parallel mobile and desktop tests;
- create `docs/authentication.md` with the route, auth-state, redirect, error,
  and hosted-configuration contracts from this plan;
- create `scripts/with-local-supabase.ts` to read local test credentials from
  `supabase status --output json`. It passes only the API URL and publishable
  key to Vite, keeps the `service_role` key inside the Node test process, and
  never prints any credential;
- add `test:e2e:local` to `package.json` and update
  `.github/workflows/ci.yml` to start the full local Supabase stack rather than
  the database-only subset;
- create `tests/e2e/support/auth-admin.ts` for local-only account setup and
  `tests/e2e/support/mailpit.ts` for finding a message by recipient through the
  Mailpit API. The admin helper must reject every API URL that is not a loopback
  address. Neither helper may run against a hosted project.

Acceptance criteria:

- the existing bootstrap browser tests pass with values discovered from the
  local Supabase stack;
- the test runner passes only the local URL and publishable key to browser code;
- the local Auth health endpoint and Mailpit API respond before browser tests
  begin;
- CI stops the local stack in an `always` cleanup step.

Validation:

```bash
bunx supabase start
bun run test:e2e:local -- bootstrap
bunx supabase test db
bun run check
bunx tsc --noEmit
bunx supabase stop
```

Commit:

```text
test: prepare local authentication verification
```

Implementation record (2026-08-25):

- Local Auth now requires email confirmation and eight-character passwords,
  accepts only the Vite and Playwright application origins, and permits enough
  local email sends for parallel browser projects.
- The local E2E launcher discovers the running stack without printing
  credentials, waits for Auth and Mailpit, builds with public values only, and
  keeps the service role key out of the Vite build and preview server.
- The admin and Mailpit helpers reject hosted URLs. Focused tests cover those
  guards and Mailpit recipient lookup.
- The bootstrap browser suite passed in both Playwright projects. A local Auth
  smoke observed weak-password rejection, confirmation-required registration,
  and delivery to Mailpit.

### 2. Deliver session restoration, login, and logout

Status: completed on 2026-08-25

Create:

- `src/features/auth/auth-service.ts` as the only feature boundary that calls
  `supabase.auth`;
- `src/features/auth/auth-errors.ts` for stable Portuguese copy keyed by Auth
  error code;
- `src/features/auth/auth-session.tsx` and focused tests for the initial
  session, auth events, identity changes, and cleanup;
- `src/features/auth/auth-shell.tsx` and `login-page.tsx` with labelled email
  and password fields, correct autocomplete attributes, pending state, and an
  accessible error alert;
- `src/features/auth/authenticated-home-page.tsx` as the temporary `/app`
  destination with the current email and a logout action;
- `src/routes/login.tsx`, `src/routes/_authenticated.tsx`, and
  `src/routes/_authenticated.app.tsx` as thin route declarations;
- `tests/e2e/auth-login.spec.ts` against the local Auth service.

Update:

- `src/app/app.tsx`, `providers.tsx`, `router-context.ts`, and `router.ts` to
  provide the resolved auth state to the router and invalidate it after auth
  changes;
- the Auth session provider integration so logout or a user-ID change removes
  the previous user's remote cache;
- `src/features/home/home-page.tsx` so login is discoverable from `/`.

Acceptance criteria:

- opening `/app` while signed out redirects to
  `/login?redirect=%2Fapp` without rendering private content first;
- valid credentials open `/app`, and reloading keeps the authenticated page;
- invalid credentials show `Email ou senha inválidos` without exposing the raw
  Supabase message;
- a crafted external `redirect` never navigates away from the current origin;
- logout removes the visible account, clears user-scoped cached data, and the
  browser Back action cannot reopen `/app`;
- an authenticated user who opens `/login` returns to `/app`.

Validation:

```bash
bun run test -- auth-session login-page protected-navigation
bun run test:e2e:local -- auth-login
bun run check
bunx tsc --noEmit
bun run build
```

Proposed commit:

```text
feat: add email login and protected navigation
```

Implementation record (2026-08-25):

- The application now waits for `INITIAL_SESSION`, restores persisted sessions,
  and clears TanStack Query before a different user or anonymous state renders.
  Token refreshes for the same user preserve the cache.
- `/app` is protected by the pathless `_authenticated` route. Login accepts
  only same-origin application paths, uses stable Portuguese error copy, and
  ordinary logout affects only the current session.
- Focused tests cover the Auth boundary, initial session, identity changes,
  cleanup, form behavior, redirects, and protected navigation. The local E2E
  flow passed in mobile and desktop Chromium with real GoTrue sessions.
- Login and the authenticated placeholder were inspected at 360 by 800 and
  1280 by 800 CSS pixels. Registration discoverability moves with the real
  `/register` route in delivery step 3, avoiding a dead link in this step.

### 3. Deliver registration and email confirmation

Create:

- `src/features/auth/register-page.tsx` with email, password, password
  confirmation, pending state, and an accessible result message;
- `src/features/auth/confirm-page.tsx` for successful, expired, malformed, and
  denied callback states;
- `src/routes/register.tsx` and `src/routes/auth.confirm.tsx`;
- component tests for client validation, generic account copy, callback
  failures, and authenticated redirects;
- `tests/e2e/auth-registration.spec.ts`, which creates the account through the
  form, follows the captured Mailpit link, and reaches `/app`.

Update:

- `src/features/home/home-page.tsx` so registration is discoverable from `/`.

Acceptance criteria:

- a password shorter than eight characters or a mismatched confirmation does
  not submit;
- a valid registration shows instructions to check the submitted email and
  does not create an authenticated page before confirmation;
- the completion state does not reveal whether the address was already
  registered;
- following the confirmation email returns to the same application origin,
  removes token and error fragments from the visible URL, and opens `/app`;
- an expired or malformed confirmation link shows a safe retry path without a
  raw token or provider error.

Validation:

```bash
bun run test -- register-page confirm-page
bun run test:e2e:local -- auth-registration
bun run check
bunx tsc --noEmit
bun run build
```

Proposed commit:

```text
feat: add account registration and confirmation
```

### 4. Deliver password recovery and replacement

Create:

- `src/features/auth/forgot-password-page.tsx` with generic completion copy;
- `src/features/auth/update-password-page.tsx` that waits for a valid recovery
  session before accepting a new password;
- `src/routes/forgot-password.tsx` and
  `src/routes/auth.update-password.tsx`;
- component tests for rate limits, invalid links, password validation, success,
  and provider failures;
- `tests/e2e/auth-password-recovery.spec.ts`, which follows the local recovery
  email and verifies the credential change.

Acceptance criteria:

- requesting recovery for existing and unknown well-formed emails renders the
  same message;
- rate-limit failures ask the user to wait without exposing internal details;
- a recovery link opens only the password-replacement form, not `/app`;
- an invalid or expired recovery URL offers a return to
  `/forgot-password`;
- after replacement, the app removes sensitive URL data, signs out, and shows
  the login page with a success message;
- the old password fails and the new password opens `/app`.

Validation:

```bash
bun run test -- forgot-password update-password
bun run test:e2e:local -- auth-password-recovery
bun run check
bunx tsc --noEmit
bun run build
```

Proposed commit:

```text
feat: add password recovery
```

### 5. Verify environment isolation and close the feature

Update:

- `docs/authentication.md` with the observed local and hosted behavior;
- `docs/architecture.md` with the session, router-context, and query-cache
  boundaries;
- `docs/implementation-plan.md` with the delivered commits, checks, and any
  external beta prerequisite that remains open;
- auth screens after a keyboard and 360 px pass, but only for defects observed
  during verification.

Acceptance criteria:

- a Deploy Preview uses `finance-pwa-dev` and can never mutate the production
  Supabase project;
- production Auth allows only the exact production confirmation and recovery
  destinations;
- local registration, confirmation, login, reload, logout, recovery, and new
  password login pass in mobile and desktop Chromium;
- one approved hosted smoke completes confirmation and recovery on its own
  origin;
- no access token, refresh token, password, confirmation link, recovery link,
  or financial payload appears in console, test, CI, or Netlify logs;
- the home, offline page, not-found page, PWA manifest, and update prompt still
  behave as before.

Validation:

```bash
bunx supabase start
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
bunx supabase stop
```

Runtime checks after explicit authorization:

- inspect the Supabase Auth Site URL and redirect allow-list in the development
  and production projects;
- inspect Netlify production and Deploy Preview variable scopes without
  printing their values;
- complete confirmation and recovery through the Deploy Preview;
- confirm the resulting callback stays on the preview origin;
- verify an anonymous request to existing RLS-protected data still fails;
- stop every local process started for the checks.

Proposed commit:

```text
docs: record authentication delivery
```

## Final merge gate

- [ ] All five delivery steps have focused commits on `feat/authentication`.
- [ ] Local Auth email confirmation is enabled and covered through Mailpit.
- [ ] Auth state reaches the router only after initial session restoration.
- [ ] Logout and identity changes clear user-scoped query data.
- [ ] Login and recovery do not disclose account existence.
- [ ] Confirmation and recovery callbacks remove sensitive URL data.
- [ ] Deploy Preview and production use separate Supabase projects.
- [ ] The complete local gate passes.
- [ ] The pull request receives a distinct Netlify Deploy Preview.
- [ ] Hosted smoke results and remaining SMTP work are recorded.
- [ ] The roadmap marks step 3 complete in the same pull request.

## References

- [Supabase password authentication](https://supabase.com/docs/guides/auth/passwords)
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls)
- [Supabase Auth error codes](https://supabase.com/docs/guides/auth/debugging/error-codes)
- [Supabase `onAuthStateChange`](https://supabase.com/docs/reference/javascript/auth-onauthstatechange)
- [Supabase sign-out scopes](https://supabase.com/docs/guides/auth/signout)
- [Supabase local email testing](https://supabase.com/docs/guides/local-development/cli/testing-and-linting)
- [TanStack Router authenticated routes](https://tanstack.com/router/latest/docs/guide/authenticated-routes)
- [TanStack Router file naming](https://tanstack.com/router/latest/docs/routing/file-naming-conventions)
- [Netlify Deploy Previews](https://docs.netlify.com/deploy/deploy-types/deploy-previews/)
