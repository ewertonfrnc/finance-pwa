# Starting-position onboarding implementation plan

Status: planned on 2026-08-27

Last reviewed: 2026-08-27

Roadmap step: 7

Delivery branch: `feat/starting-position`

## Outcome

Require every signed-in user to record one opening financial position before
opening the financial workspace. The user enters a signed balance and the
calendar date whose opening balance it represents, reviews both values, saves
through the existing idempotent RPC, and then reaches `/app`.

A returning user with a saved position bypasses onboarding. A route failure
does not masquerade as an absent position, and a user without a position can
leave and return without losing the `/onboarding` entry point.

## Delivery dependency

Do not start the delivery branch until roadmap step 6 has reached `main`.
Planning happened on `feat/transaction-kinds` at `5a09715`, while `main` was
still `c1c0469`. Step 7 must branch from the updated `main` that contains the
four transaction kinds and the `PT409` conflict correction. It must not carry
step 6 as an unmerged branch dependency.

## Starting point

The following already exists and must be preserved:

- `supabase/migrations/20260825010000_database_foundation.sql` creates
  `public.starting_positions`, its owner-only RLS policies, and
  `initialize_starting_position(bigint, date)`;
- each user can have at most one position because `user_id` is the primary key;
- `balance_cents` accepts every signed JavaScript-safe integer from
  `-9007199254740991` through `9007199254740991`, including zero;
- `effective_on` is a PostgreSQL `date` and means the balance at the opening of
  that calendar date. Transactions on the same date apply after it;
- the RPC derives the owner from `auth.uid()`, accepts no user ID, and runs as
  `security invoker` under the existing owner-only insert policy;
- an identical retry returns the existing row. A different retry returns
  `23505:starting_position_already_exists` without replacing it;
- authenticated users can select and insert their own position, but cannot
  update or delete it. Anonymous users have no table or function privilege;
- `src/lib/supabase/database.types.ts` already contains the row and RPC types;
- `src/app/router-context.ts` already exposes `queryClient` and the resolved
  Auth session to route hooks;
- `src/routes/_authenticated.tsx` protects every private route from anonymous
  and password-recovery sessions, but it does not inspect financial setup;
- `/app`, `/app/transactions/new`, and
  `/app/transactions/$transactionId/edit` are siblings under that Auth route.
  Guarding `/app` alone would leave both mutation routes open;
- `src/features/transactions/transaction-money.ts` and
  `transaction-calendar.ts` contain centavo and date-only mechanics that the
  onboarding needs, but they are currently owned by the transactions feature;
- `src/app/unsaved-changes.tsx` already coordinates route blocking,
  `beforeunload`, and deferred PWA updates for a dirty financial form;
- the current E2E users created through `createLocalAuthUser` have no starting
  position. Adding the gate without updating fixtures would redirect the Auth
  login, password recovery, and every transaction browser path to onboarding.

The existing database migration has reached `main`. This plan does not edit it
and does not add a schema migration.

## Scope

Include:

- a feature-owned read service, query options, initialization mutation, schema,
  safe error copy, and focused tests under `src/features/starting-position/`;
- a signed centavo input that supports positive, zero, and negative positions
  without relying on a mobile keyboard to expose a minus key;
- an opening-date input defaulted from the device-local calendar;
- a review state before the irreversible insert;
- `/onboarding` for an authenticated user without a position;
- a pathless positioned route that protects `/app` and every transaction route;
- loading, offline, read-error, validation, pending, retry, conflict, and
  success behavior in Portuguese;
- dirty-form protection and PWA-update deferral through the existing
  unsaved-changes boundary;
- `/app/starting-position` as a read-only path to inspect the saved values;
- a discoverable `Ponto de partida` action in the authenticated workspace;
- explicit starting-position fixtures for existing Auth and transaction E2E
  paths that are meant to represent returning users;
- a real local registration, confirmation, onboarding, reload, and return path
  through Supabase Auth and the Data API;
- architecture, Auth, finance-rule, roadmap, and detailed-plan records.

Exclude:

- updating or deleting a saved starting position;
- adding an update RPC, granting direct table updates, or changing RLS;
- treating the opening position as income or creating a transaction for it;
- balance calculations, the daily ledger, recurrence, categories, tags, or a
  monthly balance cache;
- storing the onboarding draft in local storage, Zustand, TanStack Query, or
  the service worker;
- optimistic financial UI, offline writes, background sync, or Realtime;
- importing legacy onboarding code or preserving its registration contract;
- a new production dependency for forms, icons, client state, validation, or
  components;
- hosted writes, deployment, or cloud configuration without explicit user
  authorization.

## Known correction limit

The roadmap currently asks for a later inspection path "so a wrong entry is
not permanent from the user's point of view." The shipped contract cannot
fulfill the correction part of that sentence. It permits one insert and no
update or delete. A read-only page makes the saved values visible, but does not
make them editable.

This plan keeps the documented UI-only boundary. It reduces mistakes with a
review step and exposes the authoritative row afterwards. The product must not
claim that a persisted mistake can be corrected in this release. If correction
is required before beta, plan a separate forward migration with a narrowly
granted update RPC, an authorization rule, a concurrency contract, cache
invalidation, and allowed-user and denied-user pgTAP coverage. That is a public
contract change and needs an explicit scope decision before implementation.

## Product decisions

### Opening balance and date

Ask for the balance at the opening of the selected date, not a balance at an
unspecified moment. The form copy must state that transactions recorded on the
same date apply after this value. This matches `effective_on` and prevents the
UI from quietly giving the database a different meaning.

Default the date to the device-local current date as `YYYY-MM-DD`. Do not use
`toISOString()` or any UTC conversion. Accept the full PostgreSQL range only
when the browser and shared date parser can represent the exact calendar
value.

The balance supports three observable results:

- positive, for money available at the opening of the date;
- zero, which is a valid position and must not fail required-field validation;
- negative, for an account already overdrawn.

Use a magnitude-only numeric input plus an explicit `Disponível` or
`No vermelho` choice. This keeps negative input reachable on iPhone and
Android number pads that omit a minus key. A zero magnitude serializes as zero
regardless of the selected direction.

Do not copy the legacy instruction that tells an overdrawn user to enter zero
and create an expense afterwards. The new database already models a signed
opening position, and a fabricated expense would distort transaction totals.

### Review before the write

The first submit validates the form and opens an in-page review state. It does
not call Supabase. The review shows the signed BRL value, the full localized
date, and this consequence: the value becomes the opening position and cannot
be edited in this version.

`Voltar e corrigir` restores the populated fields. `Confirmar ponto de partida`
calls the RPC. This extra confirmation is warranted because the current
contract intentionally has no correction operation.

### Route contract

| Route                                   | Access                           | Observable result                                                          |
| --------------------------------------- | -------------------------------- | -------------------------------------------------------------------------- |
| `/onboarding`                           | Authenticated without a position | Shows the entry or review state and a logout action.                       |
| `/onboarding`                           | Authenticated with a position    | Replaces the URL with `/app`, which supplies the device-local month.       |
| `/app`                                  | Authenticated with a position    | Shows the workspace.                                                       |
| `/app/transactions/new`                 | Authenticated with a position    | Shows the create form.                                                     |
| `/app/transactions/$transactionId/edit` | Authenticated with a position    | Shows the edit form or its existing not-found state.                       |
| Any positioned route                    | Authenticated without a position | Replaces the URL with `/onboarding`.                                       |
| `/app/starting-position`                | Authenticated with a position    | Shows the signed balance, effective date, and immutable-state explanation. |
| Any private route                       | Anonymous                        | Keeps the existing redirect to login with the requested URL.               |
| Any private route                       | Password recovery session        | Keeps the existing redirect to `/auth/update-password`.                    |

Add `src/routes/_authenticated._positioned.tsx` as a pathless route below the
existing Auth guard. Rename the three current financial route files so they
become children of this route. Keep `/onboarding` as an authenticated sibling,
outside the positioned route, or the missing-position redirect would redirect
back into its own guard.

The positioned route calls `queryClient.query` with the user-scoped
starting-position query. The installed TanStack Query version marks
`ensureQueryData` and `fetchQuery` as deprecated in favor of this API. The
route returns the row in context when one exists and redirects only when a
successful read returns `null`. A rejected read must render a safe
online-required or retry state. It must never be interpreted as "no position."

The gate error state includes `Tentar novamente` and `Sair`. A failed network
request must not trap a signed-in user in a page with no action.

### Query and cache contract

Read the row with direct table access behind
`readStartingPosition({ signal })`, selecting the typed row and ending with
`.maybeSingle()`. RLS makes a row owned by another user indistinguishable from
an absent row.

Use this key:

```text
['starting-position', userId]
```

Use a data-dependent `staleTime`: a saved row is `'static'` because the browser
cannot update or delete it in this step, while `null` is stale immediately and
must be checked again on the next route load. A permanently fresh `null` could
trap a user whose position was saved in another tab. `AuthSessionProvider`
already clears the complete query cache before another identity renders. Do
not create an unscoped key and do not persist this query outside memory.

After a successful RPC, put its authoritative return value into the exact
user-scoped query with `setQueryData`. Then invalidate the router and replace
the URL with `/app`. Do not refetch a row the server just returned and do not
invalidate transaction months. The opening position is not a transaction.

### Retry and conflict behavior

Keep the populated form and review values after every failed request. A user
can press the same confirmation again. The normalized balance and date remain
identical, so the existing RPC returns the same row if the first request
committed but its response was lost.

Map errors by the stable code and message pair:

| Code and message                         | UI result                                                                           |
| ---------------------------------------- | ----------------------------------------------------------------------------------- |
| `22023:balance_cents_out_of_range`       | Ask for a supported balance.                                                        |
| `22023:effective_on_out_of_range`        | Ask for a valid opening date.                                                       |
| `42501:authentication_required`          | Explain that the session expired and offer logout/login recovery.                   |
| Other `42501`                            | Use permission-denied copy without provider details.                                |
| `23505:starting_position_already_exists` | Refetch the authoritative row and show it instead of retrying a conflicting insert. |
| Unknown or network error                 | Keep the draft and show a generic retry message.                                    |

An identical repeat does not produce `23505`; it is a successful RPC result.
The `23505` branch means another tab, device, or earlier submission saved
different values. After that error, fetch the saved position, seed the cache,
and replace the URL with `/app/starting-position?notice=already-saved`. The
detail page tells the user that the displayed values won and does not imply
that their rejected values were persisted.

### Shared centavo and calendar mechanics

Do not import transaction business modules into the starting-position feature
and do not write a second parser for the same wire primitives.

Move the reusable centavo digit parser, safe-centavo bound, BRL magnitude
formatter, and signed BRL formatter to `src/lib/brl-money.ts`. Keep
transaction-specific positive-amount assertions in
`src/features/transactions/transaction-money.ts`, backed by the shared helper,
so transaction output and errors remain unchanged.

Move the reusable `YYYY-MM-DD` parser, local current date builder, and local
calendar-date constructor to `src/lib/calendar-date.ts`.
`transaction-calendar.ts` consumes them without changing month navigation,
formatting, clamping, or date footnotes. The starting-position schema consumes
the same parser and default-date function.

This is a move to neutral ownership for primitives now used by two financial
features. It is not a generic form abstraction.

### Draft, offline, and PWA behavior

Changing balance direction, digits, or date makes the form dirty. Register the
dirty state through `useUnsavedChangesGuard` and use the same TanStack Router
blocker pattern as `TransactionForm`. Browser unload and a ready service-worker
update remain deferred while the draft is dirty.

The initialization button is disabled while offline or pending. Offline copy
states that the draft remains on the current screen. Do not persist the draft
across a full browser close. The roadmap requirement to resume onboarding
means a user who still has no row is routed back to `/onboarding`, not that the
app stores unsaved financial input.

The global offline banner remains the application-wide network signal. The
onboarding and gate add focused copy because those states explain why the
financial action or route cannot continue.

## Delivery steps

Each step is one focused commit on `feat/starting-position`. Keep the sequence
because later steps consume files and route context created earlier.

### 1. Move shared money and date-only primitives to neutral ownership

Create:

- `src/lib/brl-money.ts` and `src/lib/brl-money.test.ts` for safe integer
  centavo parsing, unsigned BRL formatting, and signed BRL formatting with the
  existing Unicode minus glyph;
- `src/lib/calendar-date.ts` and `src/lib/calendar-date.test.ts` for exact
  calendar parsing, device-local today, leap-year validation, and local-noon
  `Date` construction used only for presentation.

Update:

- `src/features/transactions/transaction-money.ts` and its test to consume the
  shared centavo mechanics while retaining the positive transaction contract;
- `src/features/transactions/transaction-calendar.ts` and its test to consume
  the shared calendar parser and constructor without changing any observable
  label or route value.

Acceptance criteria:

- existing transaction money and calendar tests pass unchanged;
- shared formatting covers `-9007199254740991`, zero, and
  `9007199254740991` without floating point;
- invalid dates such as `2026-02-29` fail and `2028-02-29` passes;
- device-local today does not use UTC conversion;
- no transaction page, accessible name, service input, or rendered amount
  changes.

Validation:

```bash
bunx vitest run src/lib/brl-money.test.ts src/lib/calendar-date.test.ts src/features/transactions/transaction-money.test.ts src/features/transactions/transaction-calendar.test.ts
bun run check
bunx tsc --noEmit
```

Proposed commit:

```text
refactor: share finance value primitives
```

### 2. Add the starting-position client boundary

Create:

- `src/features/starting-position/starting-position-types.ts`, deriving
  `StartingPosition` from `Tables<'starting_positions'>`;
- `starting-position-service.ts` and its test for the owner-scoped read and
  `initialize_starting_position` RPC;
- `starting-position-queries.ts` for the exact user-scoped key and query
  options;
- `starting-position-mutations.ts` for the initialization mutation and exact
  cache write;
- `starting-position-schema.ts` and its test for signed centavos, zero, and
  exact calendar-date validation;
- `starting-position-errors.ts` and its test for safe Portuguese copy keyed by
  code and stable message.

Acceptance criteria:

- a zero-row read returns `null`, one owner row returns the typed row, and a
  provider error rejects without exposing its message to UI copy;
- the read forwards its `AbortSignal` and uses no user ID filter that could
  weaken or duplicate RLS;
- initialization sends only `p_balance_cents` and `p_effective_on`;
- validation produces `-5000`, `0`, and `5000` from the same magnitude input
  and its direction choice;
- the cache key contains the authenticated user ID;
- the error mapper distinguishes an existing different position from an
  identical successful retry.

Validation:

```bash
bunx vitest run src/features/starting-position
bun run check
bunx tsc --noEmit
```

Proposed commit:

```text
feat: add starting position client boundary
```

### 3. Build the entry, review, and retry flow

Create:

- `src/features/starting-position/starting-position-page.tsx` and its focused
  component test;
- `src/features/starting-position/starting-position-form.tsx` and its focused
  validation, focus, offline, dirty, review, and retry tests.

The page receives the authenticated user ID and route callbacks from a thin
route file. Keep navigation out of the service. The form owns the draft and
review state. The page owns the mutation result, error mapping, authoritative
conflict refetch, and completion callback.

Acceptance criteria:

- the initial form defaults to zero available balance and the device-local
  current date;
- positive, zero, and negative values remain reachable with touch and keyboard;
- invalid input focuses the first invalid field and calls no service;
- the first valid submit shows review without calling Supabase;
- returning from review preserves every field;
- confirmation stays disabled offline and pending, and its explanation is
  associated with the control;
- a generic failure and an ambiguous lost response keep the exact review
  values available for retry;
- an unsaved draft blocks route navigation, browser unload, and immediate PWA
  activation through the existing application boundary;
- logout remains reachable from onboarding and never submits the form.

Validation:

```bash
bunx vitest run src/features/starting-position/starting-position-form.test.tsx src/features/starting-position/starting-position-page.test.tsx src/app/unsaved-changes.test.tsx
bun run check
bunx tsc --noEmit
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]'
```

The final grep should return no new arbitrary-value Tailwind utility with a
canonical or named-token equivalent. Inspect a legitimate match instead of
treating this command as a linter.

Proposed commit:

```text
feat: build starting position onboarding
```

### 4. Gate every financial route and prove the registration path

Create:

- `src/routes/_authenticated.onboarding.tsx`;
- `src/routes/_authenticated._positioned.tsx` with the async position guard
  and safe route error component;
- `tests/e2e/onboarding.spec.ts`;
- `createLocalStartingPositionFixture` in
  `tests/e2e/support/finance-admin.ts`.

Rename and update the `createFileRoute` IDs in:

- `src/routes/_authenticated.app.tsx` to
  `src/routes/_authenticated._positioned.app.tsx`;
- `src/routes/_authenticated.app_.transactions.new.tsx` to
  `src/routes/_authenticated._positioned.app_.transactions.new.tsx`;
- `src/routes/_authenticated.app_.transactions.$transactionId.edit.tsx` to
  `src/routes/_authenticated._positioned.app_.transactions.$transactionId.edit.tsx`.

Regenerate `src/routeTree.gen.ts` through the existing TanStack Router plugin.
Do not hand-edit generated route definitions.

Update:

- `src/app/protected-navigation.test.tsx` with explicit row, null, read-error,
  onboarding, direct create, and direct edit cases;
- `tests/e2e/auth-registration.spec.ts` so confirmation opens onboarding,
  completes the opening position, reaches the workspace, and bypasses
  onboarding after reload;
- `tests/e2e/auth-login.spec.ts` and
  `tests/e2e/auth-password-recovery.spec.ts` with an explicit saved-position
  fixture for users expected to reach `/app`;
- `tests/e2e/transactions-create.spec.ts`,
  `transactions-read.spec.ts`, `transactions-edit.spec.ts`, and
  `transactions-delete.spec.ts` with owner positions created after their Auth
  users. Do not hide financial setup inside `createLocalAuthUser`, because Auth
  tests need to choose whether the user is new or returning.

Acceptance criteria:

- registration, email confirmation, onboarding, and workspace entry form one
  real local user path;
- a missing row redirects `/app`, direct create, and direct edit to
  `/onboarding` before any transaction request runs;
- an existing row redirects `/onboarding` to the workspace and never flashes
  the form;
- an offline or failed position read shows retry and logout actions and never
  redirects to onboarding as if the read had returned `null`;
- an identical RPC repeat creates no second row and reaches the workspace;
- leaving onboarding without a row and returning to a financial route opens
  onboarding again;
- all preexisting Auth and transaction E2E paths still describe returning
  users and reach their original destination.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bunx vitest run src/app/protected-navigation.test.tsx src/features/starting-position
bun run test:e2e:local -- onboarding auth-registration auth-login auth-password-recovery transactions
bun run check
bunx tsc --noEmit
bun run build
```

Proposed commit:

```text
feat: gate finance routes by starting position
```

### 5. Expose the saved position after onboarding

Create:

- `src/features/starting-position/starting-position-detail-page.tsx` and its
  focused test;
- `src/routes/_authenticated._positioned.app_.starting-position.tsx` for
  `/app/starting-position`.

Update:

- `src/app/authenticated-app-page.tsx` and its test with a 44 by 44 accessible
  `Ponto de partida` link inside the existing account action capsule. Keep the
  logout and add actions;
- the positioned route context or detail query consumer so the detail page
  renders the authoritative cached row without a second fetch when it is
  already available;
- onboarding conflict recovery so
  `23505:starting_position_already_exists` refetches and opens the detail route
  with `notice=already-saved`;
- `tests/e2e/onboarding.spec.ts` with a conflicting other-tab setup that shows
  the saved value and date, not the rejected draft;
- `tests/e2e/transactions-read.spec.ts` with the new workspace action in its
  keyboard order, target-size, and no-overflow assertions.

Acceptance criteria:

- the workspace exposes the saved position without making the top chrome
  overflow at 360 by 800 or 1280 by 800 CSS pixels;
- the detail page shows a signed BRL value, localized effective date, opening
  semantics, a path back to the same workspace month, and honest immutable
  copy;
- a returning user opening the detail route directly sees their own row only;
- a conflicting initialization shows the already-saved row and does not imply
  that the rejected draft was accepted;
- every interactive control keeps a 44 by 44 target, visible focus, safe-area
  clearance, and a useful accessible name;
- light and dark layouts contain no horizontal overflow and do not introduce a
  color literal outside `src/styles/index.css`.

Validation:

```bash
bunx vitest run src/app/authenticated-app-page.test.tsx src/features/starting-position
bun run test:e2e:local -- onboarding transactions-read
bun run check
bunx tsc --noEmit
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]'
```

Proposed commit:

```text
feat: expose the saved starting position
```

### 6. Verify and close the feature boundary

Update:

- `docs/architecture.md` with the Auth guard, positioned guard, route tree,
  query key, cache lifetime, conflict recovery, and no-service-worker-cache
  boundaries;
- `docs/authentication.md` so confirmation and login reach either onboarding
  or the positioned destination based on the row read;
- `docs/finance-rules.md` with the observed opening-date copy, signed-input
  behavior, immutable limitation, and exact client error mapping;
- `docs/implementation-plan.md` with delivered commits and only observed
  validation;
- this file with commit IDs, exact test counts, visual observations, and
  deferred hosted checks.

Acceptance criteria:

- every roadmap acceptance criterion maps to an observed unit, database, or
  browser result;
- the complete local gate passes on the final branch tip;
- database type generation produces no diff because this step changes no
  schema;
- the built service worker still contains no Supabase, Auth, or financial
  runtime caching;
- the production artifact contains no service-role credential or financial
  fixture;
- no new avoidable bracket-syntax Tailwind class remains in added markup;
- no Playwright report, screenshot, trace, video, `test-results`, or changed
  `report.html` remains from this validation;
- documentation does not claim that a saved position is editable or that a
  hosted write or physical-device pass occurred when it did not.

Validation:

```bash
bunx supabase status
bunx supabase db reset
bunx supabase test db
bun run db:types
git diff --exit-code -- src/lib/supabase/database.types.ts
bun run check
bunx tsc --noEmit
bun run test
bun run test:e2e:local
bun run build
git diff --check
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]'
```

Stop the local stack only if this work started it:

```bash
bunx supabase stop --no-backup
```

Proposed commit:

```text
docs: close starting position onboarding
```

## Final merge gate

Before opening the pull request:

- confirm roadmap step 6 is present in `main` and this branch contains no
  unmerged step 6-only history;
- inspect `git status`, the complete diff from `main`, and every branch commit;
- rerun the complete delivery-step 6 gate on the final branch tip;
- verify no database migration was added or historical migration edited;
- verify generated database types remain reproducible;
- verify anonymous denial, owner-only reads, and idempotent initialization still
  pass in pgTAP;
- verify every existing E2E user expected in the workspace has an explicit
  position fixture, while registration starts without one;
- verify a failed position read never routes to onboarding;
- verify the built service worker has no runtime cache for Supabase, Auth, or
  financial data;
- request explicit authorization before pushing, opening a pull request,
  creating a hosted user or financial row, or deploying.

The pull request squash commit is:

```text
feat: add starting position onboarding
```

## Deferred hosted and device checks

These checks require explicit authorization and do not block local
implementation:

- open a Netlify Deploy Preview that uses `finance-pwa-dev`, never production;
- register and confirm one disposable development user, save a non-sensitive
  test position, and verify the RPC request targets the development project;
- reload, sign out, sign back in, and observe that the saved user bypasses
  onboarding;
- inspect browser and Netlify logs for credentials and financial payloads;
- remove the disposable development account and its cascading rows through an
  authorized local-only or hosted-admin path;
- inspect the signed input, native date picker, keyboard, review state,
  safe areas, offline-disabled confirmation, and deferred PWA update on a real
  iPhone and Android device in the roadmap step 10 device pass.

No production financial write belongs to feature verification without a
separate explicit decision.

## Official references checked for this plan

- [TanStack Router authenticated routes](https://tanstack.com/router/latest/docs/guide/authenticated-routes)
- [TanStack Router data loading and route context](https://tanstack.com/router/latest/docs/guide/data-loading)
- [TanStack Router preloading with external caches](https://tanstack.com/router/latest/docs/guide/preloading)
- [TanStack Query query options](https://tanstack.com/query/latest/docs/framework/react/guides/query-options)
- [TanStack Query `QueryClient`](https://tanstack.com/query/latest/docs/reference/QueryClient)
- [Supabase JavaScript `maybeSingle`](https://supabase.com/docs/reference/javascript/using-modifiers-maybesingle)
- [Supabase JavaScript `rpc`](https://supabase.com/docs/reference/javascript/rpc)
- [Supabase JavaScript `abortSignal`](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal)
