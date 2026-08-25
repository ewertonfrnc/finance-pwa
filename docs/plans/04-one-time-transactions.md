# One-time transactions implementation plan

Status: in implementation

Last reviewed: 2026-08-25

Roadmap step: 4

Planning branch: `chore/plan-transactions`

Delivery branch: `feat/transactions`

## Outcome

Deliver online-only management of one-time income and expense transactions. A
signed-in user can select a month, inspect only their transactions, record a
R$ 50,00 expense on a calendar date, reload and see the persisted row, edit it,
and delete it.

This step replaces the authenticated placeholder at `/app` with the first
financial workspace. It does not calculate balances or introduce recurrence.

## Starting point

The following boundaries already exist on `main` and must be preserved:

- `public.transactions` stores a positive integer magnitude, an `income` or
  `expense` kind, an optional trimmed description, a PostgreSQL `date`, and
  server timestamps;
- authenticated users have `select` only on `public.transactions`; direct
  transaction writes are intentionally closed;
- `transactions_select_own` filters reads through `auth.uid()`;
- the browser receives only the Supabase URL and publishable key;
- `AuthSessionProvider` clears TanStack Query when the authenticated identity
  changes;
- the service worker caches the application shell and static assets, not
  Supabase, Auth, or financial responses;
- `/app` is protected by the pathless `_authenticated` route;
- `src/styles/index.css` owns semantic light and dark design tokens;
- the current authenticated placeholder says that starting-position onboarding
  is next, but the roadmap has no UI delivery step for it.

Starting-position onboarding is a separate product gap. It must be planned
before the monthly balance screen in roadmap step 5, but it does not block
one-time transaction CRUD and is not folded into this feature branch.

## Scope

Include:

- create, update, and delete RPCs for one-time transactions;
- monthly reads through the existing RLS-protected table;
- a mobile-first monthly history at `/app`;
- full-page create and edit routes;
- exact centavo input and `YYYY-MM-DD` calendar handling;
- server and client validation;
- idempotent create retries and optimistic concurrency for edit and delete;
- focused TanStack Query invalidation;
- offline, loading, empty, pending, conflict, not-found, and error states;
- unsaved-form protection for navigation, browser unload, and PWA updates;
- component, service, database, and local end-to-end tests.

Exclude:

- starting-position onboarding and balance calculations;
- recurring transactions, installments, tags, category budgets, and transfers;
- optimistic financial UI, offline writes, background sync, and Realtime;
- a persisted TanStack Query cache or any service-worker financial cache;
- a manual theme picker, broad redesign of public/Auth screens, or a new design
  system package;
- swipe-to-delete, haptics, native-only controls, and a separate desktop app;
- importing code or runtime contracts from either legacy frontend.

## Decisions

### Database write boundary

- Keep direct `insert`, `update`, and `delete` privileges revoked from
  `authenticated`. The browser calls three narrowly granted RPCs instead.
- Use `security definer` for these RPCs because `security invoker` cannot write
  while the caller intentionally lacks table-write privileges. This is a
  documented authorization need, not a convenience choice.
- Give every definer function `set search_path = ''`, schema-qualify every
  relation and type, derive ownership from `(select auth.uid())`, and never
  accept `user_id`.
- Revoke execution from `public` and `anon`; grant it only to `authenticated`
  and `service_role`.
- Keep `transactions_select_own` and the table `select` grant as the read
  boundary. Do not add table write policies that would make direct Data API
  mutations possible.
- Return the persisted or deleted transaction row from each RPC so the client
  can use the authoritative date and concurrency version.

### RPC contract

| Function             | Parameters                                                                                                                                            | Result                     | Required behavior                                                                                                                                |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `create_transaction` | `p_id uuid`, `p_kind transaction_kind`, `p_amount_cents bigint`, `p_description text`, `p_transaction_date date`                                      | One `transactions` row     | Uses `p_id` as the submission idempotency key; an identical retry returns the existing row; the same ID with different normalized content fails. |
| `update_transaction` | `p_id uuid`, `p_expected_updated_at timestamptz`, `p_kind transaction_kind`, `p_amount_cents bigint`, `p_description text`, `p_transaction_date date` | Updated `transactions` row | Locks the caller-owned row, rejects a stale version, writes a new `updated_at`, and never reveals whether a missing ID belongs to another user.  |
| `delete_transaction` | `p_id uuid`, `p_expected_updated_at timestamptz`                                                                                                      | Deleted `transactions` row | Locks and version-checks the caller-owned row before deletion; missing and foreign IDs have the same result.                                     |

`create_transaction` uses a browser-generated UUID instead of adding an
idempotency table or column. The form retains the same UUID when retrying the
same submitted payload after an ambiguous failure and creates a new UUID after
the payload changes. Mutations have no automatic retry. This prevents the
common duplicate caused by a committed request whose response was lost without
adding a second persistence concept to the first beta.

`update_transaction` and `delete_transaction` use the row's exact
`updated_at` as an optimistic concurrency token. Each function selects the
owned row `for update`, compares the expected version, and then mutates it in
the same database transaction. The UI never silently overwrites a change made
from another tab or device.

Normalize `p_description` with `nullif(btrim(p_description), '')`. Persist no
leading or trailing whitespace. Validate nulls and bounds before mutating even
though table constraints remain the final invariant.

### Error contract

Extend `docs/finance-rules.md` with these stable database outcomes:

| Code                            | Stable message or source                      | UI meaning                                                    |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------- |
| `22023`                         | `transaction_id_required`                     | The mutation request has no transaction ID.                   |
| `22023`                         | `transaction_kind_required`                   | The create or update request has no transaction kind.         |
| `22023`                         | `transaction_version_required`                | The update or delete request has no concurrency version.      |
| `22023`                         | `amount_cents_out_of_range`                   | The amount is missing, zero, or above the safe integer limit. |
| `22023`                         | `transaction_date_out_of_range`               | The date is missing or outside the supported range.           |
| `22023`                         | `description_too_long`                        | The normalized description exceeds 120 characters.            |
| `23505`                         | `transaction_id_conflict`                     | A submission ID already represents different content.         |
| `P0002`                         | `transaction_not_found`                       | The row is missing or unavailable to this user.               |
| `40001`                         | `transaction_conflict`                        | The row changed after the form loaded.                        |
| `42501`                         | `authentication_required` or privilege denial | The request is not authorized.                                |
| PostgreSQL enum/date input code | Server parser                                 | A caller bypassed the typed form with an invalid wire value.  |

Components translate known codes and stable messages into Portuguese. They use
generic retry copy for unknown provider failures and never render raw SQL,
policy names, JWT details, or financial payloads.

### Monthly read contract

- Represent a selected month in the URL as `?month=YYYY-MM`. Invalid or missing
  values normalize to the device-local current month with a replace navigation.
- Derive `[monthStart, nextMonthStart)` with pure string/integer calendar
  helpers. Do not pass date-only values through UTC or `toISOString()`.
- Query `public.transactions` directly with
  `transaction_date >= monthStart` and `transaction_date < nextMonthStart`.
  RLS remains authoritative; do not send a user filter as authorization.
- Order by `transaction_date desc`, `created_at desc`, and `id desc`. The ID is
  the deterministic tie-breaker required before range pagination.
- Read pages of 200 rows with `.range(from, to)` until a short page arrives.
  This avoids silently truncating a high-activity month at the hosted Data API
  row limit without introducing infinite-scroll UI in the first beta.
- Pass TanStack Query's `AbortSignal` to Supabase so switching months cancels
  obsolete page requests.
- Use `['transactions', userId, 'month', month]` for monthly query keys and
  `['transactions', userId, 'detail', transactionId]` for detail keys. RLS is
  still the security boundary; including `userId` also prevents accidental
  cross-identity cache reuse.
- Do not show the previous month's data as placeholder content under a new
  month label. The new month renders its own loading state.
- Do not render an in-memory financial result as current while offline. Keep an
  open form draft visible, but replace reads with the explicit online-required
  state and disable writes.

### Mutation and cache contract

Do not use optimistic UI in this step. Financial writes appear only after the
RPC succeeds and the relevant refetch finishes.

| Mutation                   | Invalidate after success                             | Navigation                                                                       |
| -------------------------- | ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| Create                     | The month containing the returned `transaction_date` | Await invalidation, then replace with `/app?month=<returned month>`.             |
| Update without date change | The original month and transaction detail            | Await invalidation, then return to that month.                                   |
| Update with date change    | Both original and returned months plus detail        | Await both invalidations, then replace with the returned month.                  |
| Delete                     | The month from the deleted row and its detail key    | Remove the detail query, await month invalidation, then replace with that month. |

TanStack Query mutations remain pending until awaited invalidation completes.
Buttons stay disabled while pending. A failed RPC keeps the form or
confirmation open with the user's input intact.

### Route and form contract

| Route                                   | Access        | Behavior                                                                  |
| --------------------------------------- | ------------- | ------------------------------------------------------------------------- |
| `/app?month=YYYY-MM`                    | Authenticated | Monthly history, month navigation, account/logout access, and add action. |
| `/app/transactions/new?month=YYYY-MM`   | Authenticated | Creates a one-time transaction in a full-page form.                       |
| `/app/transactions/$transactionId/edit` | Authenticated | Loads an owned row, edits with version protection, and exposes delete.    |

The create route defaults to `expense`, zero centavos, and a date in the
selected month. For the current month it uses today. For another month it uses
the current day number clamped to that month's last day. The selected date is
always visible before submission.

Use a digit-driven money input like the existing mobile app: `inputMode="numeric"`
stores a decimal digit string representing centavos and displays it with
`Intl.NumberFormat('pt-BR')` for the whole-reais `BigInt` plus two explicit
centavo digits. Parsing uses string or `BigInt` comparison and converts to
`number` only after the value is known to fit the documented safe integer
range. Never divide by 100 in floating point to interpret or format the amount.

The description is optional to match the database contract, visibly labelled
as optional, and limited to 120 characters. An empty or whitespace-only value
becomes `null`. The native `input[type='date']` owns date entry; the application
validates its exact `YYYY-MM-DD` value without timezone conversion.

Form state stays local. Do not add Zustand, React Hook Form, Zod, a component
library, or an icon dependency. Small feature-owned SVGs are sufficient for
the few required controls.

### Unsaved changes and PWA updates

- A dirty form uses TanStack Router's `useBlocker` with a custom confirmation
  dialog for in-app navigation and enables `beforeunload` for refresh, tab
  close, and browser-controlled exits.
- Introduce one small app-level unsaved-changes context because the transaction
  form produces the state and the global service-worker prompt consumes it.
  This is not remote state and does not justify Zustand.
- When a service-worker update is waiting and a form is dirty, the dialog may
  offer **Depois**, but must not call `updateServiceWorker(true)`. Its copy asks
  the user to save or discard the draft first.
- After a successful mutation or explicit discard, clear the dirty state before
  navigation so the app does not show a false warning.

### Visual direction

Preserve the product language already visible in the legacy Finance app and
web app without importing their code:

- month navigation remains the primary temporal control;
- the amount is the strongest element in the form;
- income and expense use semantic color in addition to text and iconography;
- transaction rows remain compact, readable, and grouped by calendar date;
- create and edit stay focused tasks rather than expanding inline inside the
  ledger.

The current PWA remains the source of truth for the Trajeto mark, warm canvas,
lime accent, typography, and automatic light/dark themes. Do not transplant the
legacy teal palette wholesale. Add only `income` and `expense` semantic tokens,
derived from the existing success and coral families, with contrast checked in
both themes.

Make the financial workspace more iOS-like through layout and interaction, not
through imitation:

- respect `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` in
  standalone mode;
- use a restrained translucent sticky top bar with clear contrast, a centered
  month title, and 44 px minimum tap targets;
- use inset grouped surfaces, thin separators, moderate radii, and fewer deep
  shadows than the marketing/Auth cards;
- use a two-option segmented control for **Saída** and **Entrada**;
- keep form actions in a safe-area-aware sticky bottom region on phones;
- use a full-page form on narrow viewports and a centered, bounded panel on
  desktop instead of maintaining separate mobile and desktop implementations;
- limit transitions to short opacity/translation feedback and honor the
  existing `prefers-reduced-motion` rule;
- use a destructive confirmation sheet on phones and a centered confirmation
  dialog at wider breakpoints; do not hide delete behind a swipe gesture.

“iOS-like” does not mean reproducing UIKit, Liquid Glass, SF Symbols, native
haptics, or platform-specific navigation. Financial values and actions must
remain legible on Android, desktop, dark mode, and reduced-motion settings.

## Delivery steps

The delivery branch keeps the commits below while it is reviewed. The pull
request is squash-merged as `feat: add one-time transaction management` only
after the complete feature gate passes.

Before a step that uses the database or local E2E runner, check
`bunx supabase status`. Start the stack when it was stopped and stop it after
the step; reuse and leave it running when it was already active.

### 1. Establish the transaction mutation boundary

Status: completed locally on 2026-08-25

Create:

- `supabase/migrations/20260825020000_transaction_mutations.sql` with the three
  RPCs, validation, ownership checks, idempotent create behavior, row locking,
  concurrency checks, explicit `search_path`, and focused execute grants;
- `supabase/tests/database/transaction_mutations_test.sql` with allowed,
  denied, invalid, idempotent, conflict, cross-user, and direct-write cases.

Update:

- `docs/finance-rules.md` with the RPC signatures, client-generated transaction
  ID, normalization, concurrency token, authorization behavior, and errors;
- `docs/architecture.md` with the documented reason for `security definer` and
  the split between direct RLS reads and RPC-only writes;
- `src/lib/supabase/database.types.ts` only through `bun run db:types`.

Do not edit
`supabase/migrations/20260825010000_database_foundation.sql`; it is already on
`main`.

Acceptance criteria:

- an authenticated caller creates a row owned by `auth.uid()` without sending
  a user ID;
- retrying the same ID and normalized payload returns the same row and leaves
  the owner with one row;
- reusing that ID for different content fails with
  `transaction_id_conflict`;
- valid update and delete calls return the authoritative affected row;
- a stale `updated_at` fails with `transaction_conflict` and preserves the
  newer row;
- missing and other-user IDs both fail with `transaction_not_found` and expose
  no ownership distinction;
- zero, negative, and oversized amounts, overlong descriptions, null required
  fields, and invalid dates fail at the server boundary;
- `authenticated` still cannot insert, update, or delete the table directly;
- `anon` cannot read the table or execute any transaction RPC;
- generated TypeScript includes all three exact RPC signatures.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run db:types
bun run check
bunx tsc --noEmit
```

Verification record (2026-08-25):

- a clean reset applied the foundation and transaction mutation migrations;
- the database suite passed 71 checks across two pgTAP files, including 52
  transaction mutation checks;
- generated TypeScript contains the exact create, update, and delete RPC
  arguments and returned transaction rows;
- `bun run check`, `bunx tsc --noEmit`, and the local schema lint completed
  without errors.

Commit:

```text
feat: add one-time transaction RPCs
```

### 2. Deliver the monthly transaction history

Status: pending

Create:

- `src/features/transactions/transaction-types.ts` for feature-owned domain
  types derived from generated database rows;
- `src/features/transactions/transaction-calendar.ts` and its unit test for
  local current month, exact month bounds, previous/next navigation, date
  grouping, and clamped default dates;
- `src/features/transactions/transaction-money.ts` and its unit test for exact
  centavo display and safe digit parsing;
- `src/features/transactions/transaction-service.ts` and its test for the
  ordered, abortable, range-paginated monthly RLS read;
- `src/features/transactions/transaction-queries.ts` for user-and-month-scoped
  query options and keys;
- `src/features/transactions/transactions-page.tsx`,
  `month-selector.tsx`, `transaction-list.tsx`, and focused component tests;
- `src/app/authenticated-app-page.tsx` to compose the account action and
  transaction feature without moving Auth behavior into the transaction
  feature;
- `tests/e2e/support/finance-admin.ts`, guarded by the existing loopback-only
  local Supabase boundary, for deterministic local financial fixtures;
- `tests/e2e/transactions-read.spec.ts` for the real Auth, Data API, and RLS
  read path.

Update:

- `src/routes/_authenticated.app.tsx` to validate the optional `month` search
  value and render the financial workspace;
- `src/styles/index.css` with safe-area, grouped-surface, income, and expense
  tokens while preserving the existing brand palette and dark theme;
- `src/app/protected-navigation.test.tsx` and
  `tests/e2e/auth-login.spec.ts` to assert the new authenticated destination;
- `supabase/seed.sql` only if another deterministic month edge case is needed.

Remove the now-unused
`src/features/auth/authenticated-home-page.tsx` and its focused test only after
all route and Auth assertions use the real transaction destination.

Acceptance criteria:

- `/app` normalizes to the device-local month and keeps the selected
  `YYYY-MM` in the URL;
- previous and next controls load the correct month without showing rows from
  the prior month under the new heading;
- the page groups newest transactions by date and formats amounts as BRL while
  preserving their positive stored magnitude and kind;
- a month with no rows shows a deliberate empty state with an add action;
- loading, retryable provider failure, refetching, and offline-required states
  are distinguishable without exposing provider details;
- a fixture owned by the signed-in user renders and a fixture owned by a second
  user does not;
- 201 ordered service fixtures require two Data API pages and return without
  duplication or truncation;
- logout remains discoverable;
- 360 px and 1280 px layouts have no horizontal overflow, all interactive
  targets are at least 44 px, and light/dark meaning does not depend on color
  alone.

Validation:

```bash
bun run test -- transaction-calendar transaction-money transaction-service transactions-page protected-navigation
bun run test:e2e:local -- transactions-read
bun run check
bunx tsc --noEmit
bun run build
```

Commit:

```text
feat: add monthly transaction history
```

### 3. Deliver one-time transaction creation

Status: pending

Create:

- `src/features/transactions/transaction-errors.ts` for safe Portuguese copy
  keyed by PostgreSQL code and stable RPC message;
- `src/features/transactions/transaction-form-schema.ts` and unit tests for
  kind, exact centavos, optional description, and date validation;
- `src/features/transactions/transaction-mutations.ts` for RPC create and
  focused month invalidation;
- `src/features/transactions/transaction-form.tsx` and component tests for the
  shared create/edit fields, accessible errors, pending state, and dirty state;
- `src/features/transactions/create-transaction-page.tsx` and focused tests;
- `src/app/unsaved-changes.tsx` for the form/PWA update boundary;
- `src/routes/_authenticated.app.transactions.new.tsx` for
  `/app/transactions/new`;
- `tests/e2e/transactions-create.spec.ts` for the real form-to-RPC path.

Update:

- `src/app/providers.tsx` to provide the unsaved-change boundary;
- `src/app/pwa-update-prompt.tsx`, `pwa-update-dialog.tsx`, and their tests so
  an update cannot reload a dirty form;
- the monthly page add action to preserve its selected month when opening the
  form.

Acceptance criteria:

- opening create from August initializes a visible, valid August date; the
  current month uses today and another month clamps today's day number;
- the value control starts at `R$ 0,00`, accepts digit input as centavos, and
  submits exactly `5000` for the visible `R$ 50,00`;
- type, value, optional description, and calendar date have programmatic labels
  and visible error copy;
- invalid, zero, or oversized amounts and invalid dates do not call the service;
- while offline, the draft remains editable but submit is unavailable with a
  clear explanation;
- one submit disables duplicate interaction; retrying an unchanged ambiguous
  submission reuses its UUID, while changing the payload creates a new UUID;
- a successful create waits for the affected month to refetch, returns to that
  month, and the persisted row survives a browser reload;
- provider errors keep every field intact and never expose raw backend text;
- dirty navigation opens a discard confirmation, browser unload is protected,
  and a waiting service-worker update cannot force a reload;
- the full-page mobile form respects keyboard and bottom safe areas, while the
  desktop form remains bounded and uses the same component.

Validation:

```bash
bun run test -- transaction-form-schema transaction-form create-transaction transaction-mutations pwa-update
bun run test:e2e:local -- transactions-create
bun run check
bunx tsc --noEmit
bun run build
```

Commit:

```text
feat: add one-time transaction creation
```

### 4. Deliver conflict-safe transaction editing

Status: pending

Create:

- `src/features/transactions/edit-transaction-page.tsx` and focused tests for
  loading, not-found, failure, conflict, and success states;
- `src/routes/_authenticated.app.transactions.$transactionId.edit.tsx` for
  `/app/transactions/$transactionId/edit`;
- `tests/e2e/transactions-edit.spec.ts` for persisted editing, cross-month
  movement, and stale-version protection.

Update:

- `src/features/transactions/transaction-service.ts` with the RLS-protected
  single-row read and typed `update_transaction` RPC call;
- `src/features/transactions/transaction-queries.ts` with the detail key and
  options;
- `src/features/transactions/transaction-mutations.ts` to send
  `p_expected_updated_at` and invalidate the original and returned months;
- transaction rows so their accessible link opens the edit route;
- the shared form so edit mode initializes from the server row and clears dirty
  state after successful save or explicit discard.

Acceptance criteria:

- selecting a row opens its persisted kind, amount, description, and date;
- a direct reload of an owned edit route reconstructs the form from Supabase;
- a missing or other-user ID shows the same `Lançamento não encontrado` state
  and offers a safe return to `/app`;
- saving `R$ 50,00` as `R$ 75,00` persists and survives reload;
- moving a row from August to September removes it from August and shows it in
  September without invalidating unrelated users or all Query data;
- a concurrent server change causes `transaction_conflict`, preserves the
  newer server row, and offers an explicit reload rather than overwriting it;
- failed saves keep the edited fields and remain non-optimistic;
- Back, discard, PWA-update, offline, safe-area, and responsive behavior match
  create mode.

Validation:

```bash
bun run test -- transaction-service transaction-queries transaction-mutations transaction-form edit-transaction
bun run test:e2e:local -- transactions-edit
bun run check
bunx tsc --noEmit
bun run build
```

Commit:

```text
feat: add one-time transaction editing
```

### 5. Deliver confirmed transaction deletion

Status: pending

Create:

- `src/features/transactions/delete-transaction-dialog.tsx` and component
  tests for cancel, confirm, pending, offline, conflict, and failure behavior;
- `tests/e2e/transactions-delete.spec.ts` for the persisted delete path.

Update:

- `src/features/transactions/transaction-service.ts` with the typed
  `delete_transaction` RPC call;
- `src/features/transactions/transaction-mutations.ts` to version-check,
  remove the detail query, and invalidate only the deleted row's month;
- `src/features/transactions/edit-transaction-page.tsx` with the destructive
  action and responsive confirmation presentation.

Keep delete inside the edit flow for this beta. Do not add swipe gestures,
bulk selection, or an unconfirmed list-row action.

Acceptance criteria:

- **Excluir lançamento** is visually destructive but separated from save;
- cancel leaves the row and form unchanged;
- confirmation names the transaction without exposing hidden backend fields;
- confirm is disabled offline and while the request is pending;
- success returns to the affected month, removes the row, and remains deleted
  after reload;
- a stale version shows the same conflict recovery as edit and preserves the
  newer row;
- an RPC failure leaves the confirmation recoverable and never removes the row
  optimistically;
- database tests still prove that another user cannot delete the row even when
  they know its UUID.

Validation:

```bash
bun run test -- delete-transaction transaction-service transaction-mutations edit-transaction
bun run test:e2e:local -- transactions-delete
bunx supabase test db
bun run check
bunx tsc --noEmit
bun run build
```

Commit:

```text
feat: add one-time transaction deletion
```

### 6. Verify the complete boundary and close the feature

Status: pending

Update:

- `docs/architecture.md` with the observed read, RPC write, cache, routing,
  unsaved-change, and offline boundaries;
- `docs/finance-rules.md` if runtime behavior differs from the planned contract;
- this plan with delivered commit IDs, actual check counts, visual observations,
  and any explicitly deferred physical-device or hosted check;
- `docs/implementation-plan.md` to mark roadmap step 4 complete only after its
  local runtime gate passes and to retain the starting-position onboarding gap
  before step 5.

Acceptance criteria:

- one local browser path signs in, creates a R$ 50,00 expense, reloads, edits
  it, moves it between months, deletes it, reloads, and signs out;
- a second local user cannot observe or mutate any row from that path;
- every unknown, loading, empty, offline, pending, conflict, and success state
  has user-facing Portuguese copy and no raw provider details;
- create, edit, delete, and month navigation are inspected at 360 by 800 and
  1280 by 800 CSS pixels in light and dark schemes;
- keyboard-only navigation has a visible focus order, dialogs retain focus,
  Escape cancels only non-destructive pending-free dialogs, and screen-reader
  names describe icon-only controls;
- reduced motion, 200% zoom, long descriptions, maximum ordinary BRL display,
  and iPhone safe areas do not obscure values or primary actions;
- generated database types are reproducible and no financial request is added
  to Workbox runtime caching;
- no access token, service-role key, or financial payload appears in browser,
  test, CI, or build logs;
- existing Auth, public home, offline, not-found, manifest, and update behavior
  remain green.

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
```

After explicit user authorization, verify the Netlify Deploy Preview against
the development Supabase project only:

- create, edit, and delete one disposable transaction;
- confirm the network requests target `finance-pwa-dev`, never production;
- inspect Netlify and browser logs for credentials and financial payloads;
- install or reopen the preview on a physical iPhone and Android device, check
  the keyboard, date picker, safe areas, dark mode, offline-disabled submit,
  and deferred service-worker update while the form is dirty.

Creating a hosted transaction, changing cloud configuration, opening a pull
request, pushing, deploying, and merging remain external effects that require
explicit user authorization.

Commit:

```text
docs: close one-time transaction delivery
```

## Release checkpoint

After the squash commit reaches `main` and production deployment is explicitly
authorized:

- use real one-time transactions for several days before starting balance
  calculations or recurrence;
- ask up to five target users to sign in and create one transaction;
- observe whether kind, amount entry, optional description, date selection,
  month navigation, editing, and deletion are understood without coaching;
- record friction as evidence; do not broaden this branch with speculative
  categories, gestures, dashboard cards, or personalization.

The unresolved starting-position UI must receive its own detailed plan before
roadmap step 5 starts. It should not be retrofitted into the transaction branch
after validation begins.

## Official references verified for this plan

- [Supabase database functions](https://supabase.com/docs/guides/database/functions)
- [Supabase Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase JavaScript RPC](https://supabase.com/docs/reference/javascript/rpc)
- [Supabase JavaScript range](https://supabase.com/docs/reference/javascript/using-modifiers-range)
- [Supabase JavaScript order](https://supabase.com/docs/reference/javascript/using-modifiers-order)
- [Supabase JavaScript abort signal](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal)
- [TanStack Query keys](https://tanstack.com/query/latest/docs/framework/react/guides/query-keys)
- [TanStack Query invalidation from mutations](https://tanstack.com/query/latest/docs/framework/react/guides/invalidations-from-mutations)
- [TanStack Router navigation blocking](https://tanstack.com/router/latest/docs/guide/navigation-blocking)
- [Apple Human Interface Guidelines: layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Apple Human Interface Guidelines: accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines: sheets](https://developer.apple.com/design/human-interface-guidelines/sheets)
