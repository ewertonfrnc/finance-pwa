# Finance PWA implementation plan

Status: in progress

Last updated: 2026-08-25

## Outcome

Deliver a mobile-first PWA on Netlify where a user can authenticate, record
transactions, inspect the current month, and understand the effect of planned
and recurring transactions. The first beta will use Supabase for Auth,
PostgreSQL, RLS, and RPCs.

`finance-pwa` is a technical name. Choosing the public product name is not a
dependency for implementation.

## Fixed decisions

- One responsive Vite and React project, not separate web and mobile projects.
- PWA installability begins in the bootstrap step. Financial writes remain
  online-only in the first beta.
- TanStack Router handles routing. TanStack Query handles remote state.
- Tailwind CSS v4 and CSS custom properties handle styling and themes.
- Zustand is deferred until shared client state justifies it.
- Supabase owns Auth and PostgreSQL. RLS protects every user-owned table.
- Financial calculations and multi-row mutations run in PostgreSQL RPCs.
- Netlify hosts the frontend. `main` deploys to production and pull requests
  receive Deploy Previews.
- The new product does not maintain compatibility with the legacy applications.
- Money uses integer centavos and calendar dates use `YYYY-MM-DD`.

## Initial scope

The first beta includes:

- registration, login, logout, and password recovery;
- a starting financial position;
- one-time income and expense transactions;
- monthly transaction history;
- running and projected monthly balance;
- recurring transactions with `single`, `following`, and `all` mutation scopes;
- installability on Android and iOS;
- light and dark themes;
- production deployment from `main`.

The first beta excludes:

- offline financial writes;
- Open Finance and bank integrations;
- data migration from legacy applications;
- native React Native applications;
- investment and credit-card modules;
- shared family accounts;
- monthly balance caching;
- a custom Go API;
- tags and detailed category budgets unless user validation makes them a
  release requirement.

## Contract boundary

| System | Role in this plan | Compatibility requirement |
| --- | --- | --- |
| `finance-pwa` | New client and owner of Supabase migrations | New contract |
| Supabase | Auth, database, RLS, RPC producer | New environment |
| `legacy/finance-api` | Behavioral reference for finance rules | Unchanged |
| `legacy/finance-app` | Behavioral reference for mobile flows | Unchanged |
| `legacy/finance-web-app` | Behavioral reference for web flows | Unchanged |
| `folga` and `folga-api` | Out of scope | Unchanged |

The new product may reuse observed business semantics, but it must not import
legacy code or require coordinated deployment with a legacy consumer.

## Delivery sequence

Each step starts from an updated `main`, uses the branch shown below, and ends
in one focused squash commit. Do not begin the next step until the previous one
has reached `main`.

### 1. Bootstrap the installable application

Status: completed — accepted on 2026-08-25

Delivery branches: `main`, `fix/pwa-icons`, and `feat/trajeto-brand-icon`

Create:

- `package.json` and `bun.lock`;
- `vite.config.ts` with React, TanStack Router, Tailwind, and Vite PWA plugins;
- `src/app/`, `src/routes/`, `src/components/`, `src/features/`, `src/lib/`, and
  `src/styles/`;
- temporary manifest metadata using `Finance PWA` and `Finance`;
- PWA icons and an offline page;
- controlled service-worker update UI;
- `netlify.toml` with the SPA fallback and safe PWA cache headers;
- `.env.example` without credentials;
- `.github/workflows/ci.yml`;
- Vitest, Testing Library, and Playwright configuration;
- `docs/architecture.md` reflecting the decisions in `AGENTS.md`.

Acceptance criteria:

- `/` renders on 360 px and desktop widths without horizontal overflow.
- A production build contains a valid manifest, service worker, and icons.
- A new version asks before reloading the application.
- Direct navigation to a client route returns the SPA rather than a Netlify 404.
- The Netlify production site builds from `main` and a pull request receives a
  distinct Deploy Preview URL.
- Helium and Safari on a physical iPhone can install the site. A physical
  Android check is deferred to the pre-beta device pass.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e
bun run build
```

Delivered commits and pull requests:

```text
9cc4137 chore: bootstrap installable finance PWA
fd4edd2 Merge pull request #1 from ewertonfrnc/fix/pwa-icons
c3a6710 Merge pull request #2 from ewertonfrnc/feat/trajeto-brand-icon
```

Implementation record (2026-08-25):

- The application shell, PWA lifecycle, responsive themes, offline route,
  Netlify configuration, CI, tests, and architecture document are implemented.
- The dependency baseline was checked against official documentation and npm
  `latest` releases. The configuration avoids deprecated APIs and experimental
  Oxlint config formats.
- Local production verification covers the 360 px and desktop layouts,
  manifest, icons, service-worker registration, explicit update prompt, and
  direct client-route navigation.
- The Netlify production site builds from `main`. Installation works in Helium
  and Safari on a physical iPhone; the iPhone also opens the app shell offline
  and shows the online-only financial-data boundary.
- The final symbol direction is `Trajeto`. Its favicon, in-app mark, Apple touch
  icon, standard PWA icons, and maskable icon use the same one-color symbol.
- The user accepted the bootstrap as complete on 2026-08-25 after confirming
  the Trajeto build in Helium and Safari. A distinct Netlify Deploy Preview and
  a physical Android install remain pre-beta checks and do not block step 2.

### 2. Establish the Supabase data boundary

Status: completed on 2026-08-25

Branch: `feat/database-foundation`

Create:

- `supabase/config.toml` and deterministic seed data;
- a migration for the minimum user-owned transaction schema;
- amount, transaction-kind, and date constraints;
- RLS policies for authenticated ownership;
- an initial balance operation that derives the user through `auth.uid()`;
- pgTAP tests for anonymous denial, owner access, and cross-user denial;
- `src/lib/supabase/client.ts`;
- generated database types and a reproducible `db:types` script;
- `docs/finance-rules.md` with the new wire types, nullability, date format,
  amount units, errors, and authorization rules.

Do not add recurrence, tags, category budgets, or a balance cache in this step.

Acceptance criteria:

- A clean local reset recreates the schema without dashboard actions.
- An authenticated user can create and read only their own starting position.
- Anonymous access and cross-user reads and writes fail.
- TypeScript database types match the local schema.

Validation:

```bash
bunx supabase start
bunx supabase db reset
bunx supabase test db
bun run db:types
bunx tsc --noEmit
bun run build
```

Implementation record (2026-08-25):

- The local Supabase configuration, deterministic seed, schema migration,
  grants, RLS policies, idempotent starting-position RPC, pgTAP tests, typed
  browser client, generated types, CI database gate, and finance rules are
  implemented.
- A real local Data API smoke created an authenticated user and starting
  position. A matching retry returned the same row, a conflicting retry
  returned `23505`, the owner saw one row, and anonymous access returned 401.
- `20260825010000_database_foundation.sql` is applied to the linked
  `finance-pwa-dev` project. A second dry-run reported no pending migrations,
  the remote schema lint passed, generated `public` types matched the local
  schema, and anonymous table and RPC requests returned 401.

Commit:

```text
feat: establish Supabase data foundation
```

### 3. Add authentication and protected navigation

Status: completed on 2026-08-25

Delivery branch: `feat/authentication`

Pull request: #4

Merge commit: `9b2ea93`

Detailed plan: [`docs/plans/03-authentication.md`](plans/03-authentication.md)

Create:

- `src/features/auth/` services, schemas, components, and tests;
- login, registration, forgotten-password, and reset-password routes;
- authenticated route protection and session restoration;
- explicit logout behavior;
- account confirmation and password-recovery callbacks;
- query-cache isolation across logout and user changes;
- redirect handling and Supabase environment isolation for localhost, Netlify
  production, and Deploy Previews.

Acceptance criteria:

- A visitor who opens a private route reaches login.
- A user can register, refresh the browser, and remain authenticated.
- Invalid credentials show a useful error without revealing account existence.
- Logout removes access to private routes.
- A password-reset link returns to the correct environment.
- Confirmation and recovery links remove sensitive URL data after use.
- A Deploy Preview cannot use the production Supabase project.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local -- auth
bun run build
bunx supabase test db
```

Delivered pull request:

```text
9b2ea93 Merge pull request #4 from ewertonfrnc/feat/authentication
```

Completion record (2026-08-25):

- Delivery step 1 in the detailed plan is complete. Local Auth configuration,
  the documented contract, the credential-safe E2E launcher, loopback-only
  Auth Admin and Mailpit helpers, and the full-stack CI boundary are ready.
- Delivery step 2 is complete. The application restores sessions before
  mounting the router, protects `/app`, validates post-login redirects, keeps
  query data isolated across identities, and supports local logout.
- Delivery step 3 is complete. Registration requires email confirmation and
  the callback removes sensitive URL data before opening `/app`.
- Delivery step 4 is complete. Recovery uses an isolated recovery session,
  replaces the password, signs out globally, and verifies the new credential
  through the local Mailpit flow.
- Delivery step 5 closed the feature boundary. Separate hosted Supabase
  projects and contextual Netlify values are configured. The complete local
  gate passed with 19 pgTAP checks, 85 Vitest tests, and 18 Playwright cases in
  mobile and desktop Chromium. Pull request #4 received a distinct Netlify
  Deploy Preview; a recovery request returned `200` from `finance-pwa-dev` and
  kept its callback on the preview origin.
- Hosted account confirmation, anonymous RLS denial, the final Netlify log
  review, and custom SMTP were not observed before merge. They remain explicit
  pre-beta checks in step 7 and do not block transaction development.
- Recovery mode now survives a provider remount. The local browser flow
  reloaded the cleaned password-update URL, rejected direct navigation to
  `/app`, replaced the password, and required the new credential.

Delivered branch commits:

```text
4e6dafa test: prepare local authentication verification
32466e0 refactor: harden local authentication tooling
c298705 feat: restore authenticated sessions
4a14fc8 feat: add email login and protected navigation
4ae5944 test: isolate protected navigation from Supabase config
12a8465 style: use canonical Tailwind utilities
f4a0322 docs: record authentication step two completion
854698d feat: add account registration and confirmation
ec72e53 feat: add password recovery
97b3381 test: verify password recovery locally
9271388 docs: record password recovery completion
f19d588 feat: enhance authentication documentation and tests for recovery flow
170d92c feat: persist password recovery across reloads
```

Custom SMTP remains an external beta prerequisite. The hosted default mailer
is limited to an approved smoke and cannot support invited users.

### 4. Deliver one-time transactions end to end

Status: in progress — mutation boundary (`d6a1816`) and monthly transaction
history delivered locally on 2026-08-25

Branch: `feat/transactions`

Detailed plan:
[`docs/plans/04-one-time-transactions.md`](plans/04-one-time-transactions.md)

Create:

- RPCs for creating, updating, and deleting a one-time transaction;
- an RLS-protected monthly transaction query;
- `src/features/transactions/` services, schemas, query options, mutations,
  forms, list UI, and tests;
- a mobile-first visual treatment that preserves the established Finance
  hierarchy while adding safe areas, grouped surfaces, segmented controls, and
  restrained iOS-like navigation behavior;
- no optimistic financial UI in this step; persisted results appear after the
  RPC and affected-month refetch succeed;
- focused cache invalidation for the affected month.

Acceptance criteria:

- A signed-in user records a R$ 50,00 expense on a selected calendar date.
- The transaction appears in the selected month after submission and reload.
- Editing changes the visible amount and deleting removes the transaction.
- Invalid amounts and dates fail on both the form and server boundaries.
- A second user cannot read, edit, or delete the first user's transaction.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local -- transactions
bun run build
```

Proposed commit:

```text
feat: add one-time transaction management
```

Known dependency before step 5:

- The data boundary for `starting_positions` exists, but its onboarding UI is
  not represented by a roadmap delivery step. Plan and deliver that flow after
  one-time transactions and before monthly balance work. Do not absorb it into
  `feat/transactions`.

Release checkpoint:

- Deploy `main` to Netlify.
- Use the product with real personal behavior for several days.
- Ask up to five target users to complete registration and one transaction.
- Record observed friction before expanding the feature set.

Deploying or creating real financial data requires explicit user authorization.

### 5. Add the monthly financial view

Status: pending

Branch: `feat/month-balance`

Create:

- a documented RPC contract for monthly running and projected balance;
- PostgreSQL tests for carry-forward and day-by-day results;
- `src/features/balance/` service, query, mobile-first screen, and tests;
- loading, empty, error, and negative-balance states;
- currency formatting only at the presentation boundary.

Implement the calculation without a persisted month cache. Measure the query
before proposing one.

Acceptance criteria:

- The user sees the opening balance, movements, running balance, and projected
  closing balance for a selected month.
- Adding, editing, or deleting a transaction updates the affected month.
- A month without transactions has an intentional empty state.
- Negative projections are communicated without hiding the amount or using
  shame-based language.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e -- balance
bun run build
```

Proposed commit:

```text
feat: add monthly balance projection
```

### 6. Add recurring transactions

Status: pending

Branch: `feat/recurring-transactions`

Create:

- recurrence fields and a transaction-exception table through a new migration;
- occurrence expansion for daily, weekly, monthly, and yearly recurrence;
- RPCs for update and delete scopes `single`, `following`, and `all`;
- server tests for month boundaries, February, leap years, and days 29, 30,
  and 31;
- recurrence controls and confirmation copy in the transaction feature;
- invalidation for every affected month.

Acceptance criteria:

- A monthly recurring transaction appears on valid future occurrence dates.
- Editing `single` changes only the selected occurrence.
- Editing `following` preserves past occurrences and changes the selected and
  future occurrences.
- Editing `all` changes the complete series.
- Delete behavior follows the same scopes and survives a full reload.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e -- recurrence
bun run build
```

Proposed commit:

```text
feat: add recurring transaction management
```

### 7. Prepare the external beta

Status: pending

Branch: `chore/prepare-beta`

Complete:

- re-audit production and preview environment separation;
- Netlify security and cache headers, including a restrictive CSP;
- configure custom SMTP and run the hosted confirmation and password-reset
  flows;
- verify anonymous RLS denial against the hosted non-production project;
- review the final Netlify build and runtime logs for credential or payload
  leaks;
- RLS and RPC permission audit;
- database backup procedure and a restore rehearsal using non-production data;
- error monitoring without financial payloads;
- branch protection and required GitHub checks;
- PWA install and update verification on Android and iPhone;
- privacy notice, account deletion path, and support contact;
- a rollback note for frontend deploys and forward-only database fixes.

Acceptance criteria:

- A preview deployment cannot mutate the production database.
- A new user completes registration, first transaction, month view, logout, and
  login on both Android and iPhone.
- Installed users receive a controlled update after a new deployment.
- Account deletion removes or schedules removal of user-owned data according to
  the documented behavior.
- Hosted confirmation and password recovery return to their own approved
  origins and deliver through the configured SMTP provider.
- Anonymous hosted requests cannot read user-owned financial rows.
- The production commit is traceable to `main` and all required checks passed.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e
bun run build
```

Runtime checks:

- complete the critical path against an approved non-production environment;
- inspect the installed PWA on one Android phone and one iPhone;
- confirm `manifest.webmanifest`, `sw.js`, `index.html`, and fingerprinted assets
  receive their intended cache headers on Netlify;
- stop any local servers started for validation.

Proposed commit:

```text
chore: prepare finance PWA beta
```

## Beta gate

Invite external users only when all conditions below are observed:

- [ ] Steps 1 through 7 are complete.
- [ ] Production and preview use isolated data environments.
- [ ] RLS denial tests pass for every user-owned table.
- [ ] Critical user paths pass on Android and iPhone.
- [ ] Password reset and account deletion work.
- [ ] Hosted confirmation and recovery work through custom SMTP.
- [ ] Anonymous hosted requests fail against every user-owned table.
- [ ] Netlify logs contain no credentials or financial payloads.
- [ ] A backup exists and a restore has been rehearsed outside production.
- [ ] The PWA update flow does not discard an in-progress form.
- [ ] The current production deployment maps to a commit on `main`.

## After the beta

Prioritize only from observed user behavior. Candidate work includes tags,
category budgets, imports, shared finances, offline writes, and a custom API.
Do not schedule React Native work until the PWA has repeat users and concrete
browser limitations that justify a native application.
