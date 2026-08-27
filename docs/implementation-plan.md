# Finance PWA implementation plan

Status: in progress

Last updated: 2026-08-27

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
- The visual system comes from `legacy/finance-app`: white and teal surfaces,
  category triples, and balance tiers. The warm canvas and lime accent of the
  bootstrap are retired from the product, including the public and Auth
  screens.
- The UI font is the platform font. Monetary numerals keep a subsetted
  JetBrains Mono because vertical digit alignment is what makes a column of
  amounts comparable.
- Transactions carry four kinds: `income`, `expense`, `daily`, and `savings`.
  The enum is widened through a forward migration.
- The monthly screen is a daily balance ledger with one row per calendar day,
  not a list of transactions. A list of transactions belongs to the day detail.

## Initial scope

The first beta includes:

- registration, login, logout, and password recovery;
- a starting financial position;
- one-time transactions across the four kinds;
- a daily balance ledger for the selected month;
- the day detail with its transaction list;
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
  pre-beta checks in step 10 and do not block transaction development.
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

Status: completed on 2026-08-26 and merged to `main` in `407ff85` through pull
request #6

Branch: `feat/transactions`

Detailed plan:
[`docs/plans/04-one-time-transactions.md`](plans/04-one-time-transactions.md)

Create:

- RPCs for creating, updating, and deleting a one-time transaction;
- an RLS-protected monthly transaction query;
- `src/features/transactions/` services, schemas, query options, mutations,
  forms, list UI, and tests;
- create, edit, and delete forms presented as focused tasks;
- the day detail screen that owns the transaction list;
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

Implementation record, 2026-08-26:

- Branch `feat/transactions` delivered `d6a1816` (RPC boundary), `66b48cf`
  (monthly history), `dfa19f8`/`b69e54f` (create with clamped default and
  footnote), `5f60e0d`/`39a2d92`/`e7e5dee`/`58ad03e` (conflict-safe editing),
  `a6e442c` (confirmed deletion with `footer` slot inside single `min-h-svh`),
  plus design-system commits `23b76b9`/`b87af58`/`a85ce0c`/`4b1a3a2` sequenced
  before the form. `finance-pwa-dev` was behind until `supabase db push`
  applied `20260825020000`.
- Local gate on `a6e442c`: `71` pgTAP checks, `database.types.ts` reproducible,
  `0` `oxlint` warnings, `219` Vitest across `27` files, `34` Playwright
  local cases on `mobile-chromium`/`desktop-chromium`, `38` precached Workbox
  entries with empty `runtimeCaching`. No secret or financial payload in
  build, test, or browser logs. `R$ 50` create → reload → edit → move →
  delete → reload verified plus second-user isolation and all
  unknown/loading/empty/offline/pending/conflict states in Portuguese.
- Visual `390×844` and `1280×800` light/dark matrix, keyboard focus,
  dialog focus retention, `Escape` handling, safe-area, and monetary font
  observed locally; physical device keyboard/date-picker/offline and
  Deploy Preview hosted checks remain explicit pre-beta per
  `docs/plans/04-one-time-transactions.md:870`.

Scope change accepted on 2026-08-25:

- The monthly list delivered in `66b48cf` is not the monthly screen. The
  monthly screen is a daily balance ledger and arrives in step 8. That list
  keeps its value as the day detail list and is not extended into a month view.
- The visual treatment originally planned inside this step moves to step 5, so
  that the ledger consumes a settled design system instead of one chosen inside
  a feature branch.
- The `starting_positions` onboarding gap, previously an unowned dependency,
  becomes step 7.

Release checkpoint:

- Deploy `main` to Netlify.
- Use the product with real personal behavior for several days.
- Ask up to five target users to complete registration and one transaction.
- Record observed friction before expanding the feature set.

Deploying or creating real financial data requires explicit user authorization.

### 5. Adopt the design system and the iOS shell

Status: completed on 2026-08-26

Delivery branch: `feat/transactions`

Detailed plan:
[`docs/plans/05-design-system-ios.md`](plans/05-design-system-ios.md)

Create:

- the replacement color token layer in `src/styles/index.css`, derived from
  `legacy/finance-app/src/lib/designTokens.ts`;
- the typography layer: the platform UI font and one subsetted JetBrains Mono
  face for monetary numerals;
- viewport, safe-area, and scroll behavior for a standalone iOS PWA;
- floating capsule chrome on the authenticated workspace, replacing the sticky
  header.

This step adds no route, table, RPC, or financial capability. Every screen that
exists before it exists after it with the same accessible names.

Acceptance criteria:

- The five existing routes render at 390 by 844 and 1280 by 800 CSS pixels, in
  light and dark, with no dark text on the teal accent fill.
- Monetary amounts render in the monospace face and align on the decimal
  separator; every other string renders in the platform font.
- No component or TypeScript source outside `src/styles/index.css` contains a
  color literal. `index.html` duplicates the light and dark canvas values for
  `theme-color` metadata.
- The month control and the account actions float over the scrolling list, and
  neither the first nor the last row is ever covered.
- Every control keeps its accessible name, a 44 by 44 CSS pixel target, and a
  visible keyboard focus ring.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
```

Implementation record, 2026-08-26:

- the legacy color roles, system UI typography, subsetted monetary font, iOS
  safe areas, scroll behavior, and floating workspace chrome are implemented;
- the production route matrix covered the five existing routes at 390 by 844
  and 1280 by 800 in light and dark without horizontal overflow;
- authenticated runtime checks used local Supabase Auth and Data API fixtures;
- physical checks specific to the new floating capsules and the remaining
  iOS and Android cases stay assigned to the step 10 device pass.

Delivered commits:

```text
23b76b9 feat: adopt the finance color system
b87af58 feat: adopt the finance typography scale
a85ce0c feat: extend the app under iOS safe areas
4b1a3a2 feat: float the workspace chrome over the ledger
```

Delivered squash merge:

```text
407ff85 Merge pull request #6 from ewertonfrnc/feat/transactions
```

Follow-up record, 2026-08-27:

- branch `fix/design-system-shell` replaces the three PWA and Apple icons
  with cache-busted `v4` assets using the current ink and teal palette; the
  favicon keeps `/favicon.svg` and is excluded from the manifest-based icon
  assertion that covers the three PWA icons and the Apple touch icon;
- the complete legacy red family now separates destructive and error states
  from the orange expense category, including a 6.67:1 dark destructive-button
  contrast observed in Chromium;
- the public header, global offline banner, and fixed dialogs consume their
  safe-area insets independently so the sticky header retains its inset after
  the banner scrolls away; a banner visible at the very top still counts the
  top inset twice, and this 47 px double count is accepted until a
  scroll-aware handoff is measured;
- monetary copy in the delete confirmation uses JetBrains Mono, verified with
  the loaded `FontFace` status plus the computed `fontFamily`; the amount input no
  longer requests an absent non-breaking-space glyph, and the three inline
  Auth links meet the 44 by 44 target;
- `bun run check`, `bunx tsc --noEmit`, the unit suite, and the production build
  pass. Thirty-two non-conflict local Playwright cases pass across mobile and
  desktop Chromium. The four update/delete conflict variants are blocked by
  PostgREST 14.17 retrying the application-level `40001` raised by the existing
  RPCs; this predates the design follow-up and requires a forward database fix.

### 6. Widen the transaction kinds

Status: pending

Branch: `feat/transaction-kinds`

Create:

- a forward migration that adds `daily` and `savings` to
  `public.transaction_kind`; `20260825010000_database_foundation.sql` has
  reached `main` and must not be edited;
- the documented semantics of each kind in `docs/finance-rules.md`, in
  particular that `daily` participates in the daily projection and `savings`
  leaves the available balance without being an expense;
- pgTAP coverage for the widened enum across the mutation RPCs;
- the four-way type control in the transaction form, and the category triple
  tokens for `daily` and `savings`.

Acceptance criteria:

- A signed-in user records one transaction of each of the four kinds and sees
  each rendered with its own category mark and label after a reload.
- A request carrying an unknown kind fails at the server boundary.
- Existing `income` and `expense` rows are unchanged by the migration.
- Regenerated database types match the local schema with no manual edit.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
git diff --exit-code -- src/lib/supabase/database.types.ts
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local -- transactions
bun run build
```

Proposed commit:

```text
feat: widen the transaction kinds
```

### 7. Deliver starting-position onboarding

Status: pending

Branch: `feat/starting-position`

Create:

- the onboarding flow that calls `initialize_starting_position` for a user who
  has no row;
- the routing rule that sends a user without a starting position to onboarding
  and never traps a user who already has one;
- the retry path, since an identical repeat is safe and a conflicting repeat
  returns `23505`;
- a later path to inspect the recorded position, so a wrong entry is not
  permanent from the user's point of view.

The data boundary and the RPC already exist. This step delivers only the UI and
the routing rule.

Acceptance criteria:

- A new user completes registration, records an opening balance and its date,
  and reaches the workspace.
- A returning user with a starting position never sees onboarding again.
- Submitting the same values twice does not create a second row and does not
  show an error.
- A user who abandons onboarding and returns resumes it rather than losing the
  entry point.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local -- onboarding
bun run build
```

Proposed commit:

```text
feat: add starting position onboarding
```

### 8. Add the daily balance ledger

Status: pending

Branch: `feat/month-balance`

Create:

- a documented RPC contract for daily running and projected balance across a
  month;
- PostgreSQL tests for carry-forward, day-by-day results, and the daily
  projection that resets at midnight;
- `src/features/balance/` service, query, ledger screen, and tests;
- one row per calendar day, including days without movement, with the
  end-of-day balance in its own cell;
- the balance tier palette, with a second channel that is not hue, because a
  fill that separates only by hue does not survive deuteranopia and the tier is
  the most important signal on the screen;
- the week strip on the day detail, carrying a tier dot under each day;
- the "Hoje" pill, shown only when the current day is off screen, and the
  today rule with a labeled pill in the margin;
- loading, empty, error, and negative-balance states.

Implement the calculation without a persisted month cache. Measure the query
before proposing one.

Evaluate replacing the absolute tier thresholds with a runway derived from the
user's own daily spending. Fixed bands of R$ 2.000 and R$ 1.000 describe one
spending level and turn into noise at any other.

Acceptance criteria:

- The user sees the opening balance, movements, running balance, and projected
  closing balance for a selected month.
- Every calendar day of the month has a row, including days without movement,
  and each row carries the balance at the close of that day.
- Adding, editing, or deleting a transaction updates the affected month.
- A month without transactions has an intentional empty state.
- Negative projections are communicated without hiding the amount or using
  shame-based language.
- The tier of a row is distinguishable without relying on hue.
- The last row of the month is fully readable above the floating chrome.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local -- balance
bun run build
```

Proposed commit:

```text
feat: add the daily balance ledger
```

### 9. Add recurring transactions

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

### 10. Prepare the external beta

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

- [ ] Steps 1 through 10 are complete.
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
