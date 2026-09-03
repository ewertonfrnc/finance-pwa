# Daily spending and balance ledger implementation plan

Status: planned on 2026-09-02, implementation pending

Last reviewed: 2026-09-02

Roadmap step: 8

Delivery branch: `feat/month-balance`

## Outcome

Give a signed-in user one understandable daily spending target and use it to
show a daily ledger for the selected calendar month. The ledger starts at the
saved financial position, applies recorded transactions, fills future days
with the remaining daily target, and exposes the projected month-end balance.

A user who does not know a daily target can estimate it from monthly amounts
for routine spending. A user who already knows the number can enter it
directly. The category amounts help with this calculation only. They do not
become budgets, tags, or transaction classifications in this step.

The monthly workspace becomes the ledger. Selecting a day opens its balances,
movements, projection, and transaction list. No financial response is cached
by the service worker, and no persisted monthly balance cache is introduced.

## Delivery dependency

Roadmap step 7 reached `main` in merge commit `149d1b9` on 2026-09-02. Start
implementation from that commit. Do not carry work from
`feat/starting-position` or `feat/transaction-kinds` as an unmerged branch
dependency.

Before the first implementation commit, confirm that `main` still contains:

- `20260827010000_widen_transaction_kinds.sql` and the four generated kinds;
- `20260827020000_use_http_conflict_sqlstate.sql` and canonical `PT409`
  transaction conflicts;
- the positioned route guard and saved starting-position query;
- the final zero-or-positive onboarding UI from `9ed316c`;
- a clean generated route tree and database type file.

## Starting point

The following behavior already exists and must remain intact:

- `public.starting_positions` stores one immutable, signed opening balance per
  user. `effective_on` means the opening of that calendar date, and
  transactions on that date apply after the opening balance;
- `public.transactions` stores positive magnitudes for `income`, `expense`,
  `daily`, and `savings`. Only `income` adds to available balance;
- authenticated transaction reads use owner-only RLS. Transaction writes use
  `create_transaction`, `update_transaction`, and `delete_transaction`;
- `/app?month=YYYY-MM` currently renders `TransactionsPage`, with a floating
  month selector, account actions, and add action in
  `src/app/authenticated-app-page.tsx`;
- `src/features/transactions/transaction-calendar.ts` delegates date-only
  parsing to `src/lib/calendar-date.ts` and already supports years 1 through
  9999 without UTC conversion;
- `src/features/transactions/transaction-list.tsx` owns the existing visible
  transaction rows. Its row treatment is retained for the day detail;
- transaction mutations invalidate transaction month queries only. The ledger
  needs a separate user-scoped invalidation rule because an earlier movement
  changes every later carried balance;
- starting-position completion currently opens `/app`. This step may offer
  daily setup next, but it must not make a daily setting a route authorization
  requirement;
- `src/styles/index.css` owns every application color literal and already has
  the four transaction-kind triples, safe-area utilities, monetary font, and
  reduced-motion rule;
- the service worker caches the shell and fingerprinted static assets only.

The historical migrations have reached `main` and must not be edited. This
step adds forward migrations.

## Scope

Include:

- one owner-only daily spending setting with a server-derived daily amount;
- safe create, idempotent retry, edit, conflict, and read behavior for that
  setting;
- an optional calculator using monthly estimates for food, transportation,
  leisure, shopping, and health;
- a direct path for a user who already knows the intended daily amount;
- a review state that explains the monthly total, divisor, and daily result;
- a discoverable path to inspect and change the daily target later;
- a monthly balance RPC that returns one row per calendar day;
- carry-forward from the saved starting position without a persisted cache;
- future daily projection based on the configured target;
- a daily ledger, selected-day detail, week strip, transaction list, and all
  network states;
- a runway derived from the daily target, with visible text as a second signal
  beside color;
- automatic local-day rollover while the application remains open;
- user-scoped query invalidation after daily-setting and transaction changes;
- pgTAP, unit, component, browser, and local Data API coverage;
- a local query measurement before any balance-cache proposal;
- architecture, authentication, finance-rule, roadmap, and delivery records.

Exclude:

- persisted category budgets or category-to-transaction relationships;
- saving the five calculator inputs after confirmation;
- category CRUD, tags, filters, reports, or spending limits;
- inferring the target from historical transactions;
- requiring daily setup before a positioned user can open the workspace;
- changing the immutable starting-position contract;
- rewriting or deleting transactions before the starting position;
- recurring-transaction expansion, which remains roadmap step 9;
- a monthly balance table, materialized view, or service-worker cache;
- optimistic financial results, offline writes, background sync, or Realtime;
- a new production dependency for forms, state, dates, icons, or charts;
- copying legacy code or preserving a legacy HTTP payload;
- hosted writes, deployment, or cloud configuration without explicit user
  authorization.

## Product decisions

### The daily target is explicit

Do not derive the target from transaction history. A new user has no history,
and a moving average would change the projection after the user spends. The
number would be unavailable at cold start and hard to explain afterwards.

The product asks for an intended routine-spending amount. Fixed bills belong
to `expense`, reserved value belongs to `savings`, and actual routine spending
belongs to `daily`. The copy must distinguish this target from total monthly
outgoings so rent, subscriptions, and savings are not counted twice.

The default divisor is 30 days. The user may choose 28, 29, 30, or 31. The
server calculates:

```text
daily_amount_cents = floor(monthly_amount_cents / days_per_month)
```

The calculator collects five non-negative monthly estimates:

| Input       | Examples shown in the UI                     |
| ----------- | -------------------------------------------- |
| Alimentação | mercado, refeições e delivery                |
| Transporte  | combustível, transporte público e aplicativo |
| Lazer       | passeios, jogos, eventos e encontros         |
| Compras     | roupas, presentes e itens para casa          |
| Saúde       | farmácia, consultas e cuidados recorrentes   |

The values remain in component state until confirmation. The client sums them
for review and sends only the resulting monthly total and divisor. The page
must say that the breakdown is used only for the calculation and will not be
saved as category budgets.

The direct path asks for the desired daily amount and divisor. It normalizes
the server input as:

```text
monthly_amount_cents = daily_amount_cents * days_per_month
```

The form rejects the direct value when this multiplication would exceed the
JavaScript-safe integer limit. Zero is valid and means that the user has
explicitly disabled routine-spending projection. An absent row means setup has
not been completed. These states must not be collapsed.

### Daily setup follows the starting position without becoming a gate

After a newly saved starting position, navigate to
`/app/daily-spending?source=onboarding&month=YYYY-MM`. The page offers the
calculator, direct entry, and `Agora não`. Skipping opens the selected month
without creating a setting.

Existing positioned users are not redirected when this migration reaches
them. Without a setting, the ledger still shows recorded transactions and
balances, projects no routine spending, and displays `Configure seu diário
para incluir os gastos da rotina na projeção.` with a link to the setup page.

A saved setting opens in edit mode. Because calculator inputs are not
persisted, editing starts from the saved monthly total, divisor, and daily
result. `Recalcular por categorias` intentionally starts a fresh calculation
and explains that the earlier breakdown was not stored.

### Daily-setting persistence

Add `public.daily_spending_settings` with:

| Column                 | Type          | Rule                                               |
| ---------------------- | ------------- | -------------------------------------------------- |
| `user_id`              | `uuid`        | Primary key, defaults to `auth.uid()`              |
| `monthly_amount_cents` | `bigint`      | 0 through `9007199254740991`                       |
| `days_per_month`       | `smallint`    | 28 through 31                                      |
| `daily_amount_cents`   | `bigint`      | Stored generated integer division of the two above |
| `created_at`           | `timestamptz` | Server timestamp                                   |
| `updated_at`           | `timestamptz` | Concurrency version                                |

The table has RLS and an owner-only select policy. Authenticated users receive
`select` only. Direct insert, update, and delete stay revoked. `service_role`
keeps direct maintenance privileges.

`set_daily_spending(p_monthly_amount_cents bigint, p_days_per_month smallint,
p_expected_updated_at timestamptz)` is the only browser write path. It runs as
`security definer`, uses an empty `search_path`, derives the owner from
`auth.uid()`, and returns the authoritative row.

The RPC follows these rules:

- no row plus a null expected version creates the row;
- retrying the same normalized values with a null version returns the row;
- different values with a null version conflict instead of overwriting a row
  created by another tab;
- an existing row requires its exact `updated_at` for a change;
- a successful change returns a strictly newer `updated_at`;
- a stale change raises `PT409:daily_spending_conflict` and keeps the saved
  values;
- anonymous execution and cross-user reads fail;
- validation failures use stable `22023` messages and never expose SQL or
  policy names in the UI.

Keep a single mutable setting. Do not add version history. Past and current
days never use a projected daily amount, so editing the target cannot rewrite
an observed daily balance. All future projections use the current setting.

### Calendar and projection contract

The browser passes its device-local date as `p_today`. The value affects a
read-only projection for the caller and never authorizes a write, so it does
not become a trusted ownership input. PostgreSQL still validates the supported
date range. Tests pass explicit dates and never depend on the clock.

For the current day and every past day:

```text
daily_projected_cents = 0
daily_total_cents = daily_actual_cents
```

For a future day with a configured target:

```text
daily_projected_cents = max(daily_amount_cents - daily_actual_cents, 0)
daily_total_cents = daily_actual_cents + daily_projected_cents
```

This treats a future `daily` transaction as part of that day's intended
routine spending. It does not add the full target on top of an amount already
recorded. If recorded daily spending exceeds the target, the recorded amount
wins and the projection reaches zero.

Without a setting, or with an explicit zero setting,
`daily_projected_cents` is zero. The UI distinguishes `not configured` from
`configured as zero`, even though both produce the same arithmetic result.

### Starting position and carry-forward

The saved position is the opening balance of `effective_on`:

```text
opening_balance(effective_on) = starting_positions.balance_cents
```

Transactions on `effective_on` apply after that value. Transactions before
`effective_on` remain visible in day history but do not affect any balance on
or after the starting date. They are already represented by the opening
position supplied by the user.

The RPC returns every calendar date in the requested month. For dates before
`effective_on`, movement totals remain visible but opening and closing balances
are null. A month wholly before the position explains when balance history
starts instead of inventing a zero balance.

For a month after `effective_on`, carry-forward includes:

- every recorded transaction on or after `effective_on` and before the month;
- the daily projection for dates after `p_today` and before the month;
- no transaction or projection before `effective_on`.

The calculation must work when the selected month is in the past, current, or
future, including a future month whose carry spans projected days. It must not
persist the result.

### Monthly balance RPC

Add `get_month_balance(p_month_start date, p_today date)`. Require
`p_month_start` to be the first day of a supported calendar month. The
function derives the caller with `auth.uid()`, accepts no user ID, runs as
`security invoker`, and receives execute grants only for `authenticated` and
`service_role`.

Return one ordered row per date with:

| Field                   | Meaning                                               |
| ----------------------- | ----------------------------------------------------- |
| `balance_date`          | Calendar date                                         |
| `opening_balance_cents` | Opening balance, null before `effective_on`           |
| `income_cents`          | Recorded income                                       |
| `expense_cents`         | Recorded point expenses                               |
| `daily_actual_cents`    | Recorded routine spending                             |
| `daily_projected_cents` | Unrecorded part of the future target                  |
| `savings_cents`         | Recorded reserved value                               |
| `net_movement_cents`    | Income minus every outgoing amount and projection     |
| `closing_balance_cents` | End-of-day balance, null before `effective_on`        |
| `is_projected`          | True only when `balance_date` is later than `p_today` |

Use `numeric` for intermediate sums. Before returning `bigint`, reject an
aggregate outside the JavaScript-safe integer range with
`22003:balance_out_of_range`. Individual transaction constraints are not
enough because several valid rows can overflow a JavaScript number when
summed.

Raise stable errors for a missing identity, missing starting position, invalid
month start, invalid local date, and unsafe aggregate. The client maps them to
Portuguese copy without printing provider payloads.

The result must contain at most 31 rows, including December 9999 without
constructing an invalid date in year 10000. The query may use the existing
`transactions_user_date_idx`. Do not add another index until the local
measurement shows a concrete need.

### Query and local-midnight contract

Use these keys:

```text
['daily-spending', userId]
['balance', userId, 'month', month, 'as-of', localToday]
['transactions', userId, 'day', date]
```

The daily-setting read uses direct table access and `.maybeSingle()` behind a
feature service. A successful setting mutation writes the returned row into
the exact setting key and invalidates every cached balance query for that user.

Add `src/lib/use-local-today.ts`. It returns the device-local `YYYY-MM-DD`,
schedules the next check for local midnight, and rechecks on document
visibility changes. When the date changes, the balance query key changes and
the current screen refetches with the new `p_today`. Clean up every timer and
listener on unmount. Unit tests use fake timers and simulate a suspended tab
becoming visible after midnight.

Do not put `p_today` in module scope. A date captured during the initial bundle
load would leave an installed PWA on yesterday until the process restarted.

### Transaction invalidation contract

Every transaction on or after `effective_on` affects its own day and every
later carried balance. After create, update, or delete:

- invalidate all `['balance', userId]` queries;
- invalidate the affected day transaction query;
- for an update that changes the date, invalidate both the original and
  persisted day;
- keep the authoritative transaction detail `setQueryData` and delete-detail
  removal behavior already used by edit and delete;
- await refetch of inactive destination data before navigating away from the
  form, preserving the existing non-optimistic contract.

Passing an `originalDate`, rather than only `originalMonth`, through the update
mutation is required for exact day invalidation. The mutation still sends only
the service input fields to Supabase.

### Ledger presentation

Replace the monthly transaction history in `/app` with the daily ledger. Keep
the floating month, account, and add controls.

The month summary shows:

- current month: today's recorded closing balance and projected month end;
- past month: opening and final recorded balance;
- future month: projected opening and projected month end;
- month before the starting position: the date on which balance history
  begins;
- no daily setting: the recorded result plus the setup call to action.

The ledger still renders every day when no movement exists. Its empty message
is `Nenhum movimento registrado neste mês.` inside the ledger, not a blank
replacement for the calendar rows.

Each available day row exposes its date, weekday, nonzero kind totals, closing
balance, and runway. The future daily amount is labeled `previsto`; it must not
look like a persisted transaction. A pre-position row shows its movements and
`Saldo disponível a partir de <date>` instead of `R$ 0,00`.

For the current month, scroll the today row into view once after the first
successful load. Respect reduced motion. Use an `IntersectionObserver` to show
the `Hoje` pill only when the row is outside the readable viewport. In another
month, the pill navigates to the current month and then reveals today. The
today row has a visible `Hoje` label and rule; color alone cannot identify it.

Keep enough bottom padding for the final row to clear the floating controls
and the iOS safe area. Every link and button stays at least 44 by 44 CSS pixels.

### Runway and balance tiers

Runway is based on the configured daily target:

```text
runway_days = closing_balance_cents / daily_amount_cents
```

When the setting is missing, show `Sem diário configurado`. When the target is
explicitly zero, show `Diário: R$ 0,00` and `Sem projeção diária`. Both use a
neutral balance treatment. When the closing balance is negative, show `Saldo
negativo` instead of a negative day count.

Use these product bands for non-negative balances:

| Runway             | Visible label     |
| ------------------ | ----------------- |
| 0 through 10 days  | `Até 10 dias`     |
| over 10 through 22 | `Até 22 dias`     |
| over 22 through 40 | `Até 40 dias`     |
| over 40            | `Mais de 40 dias` |

The exact approximate count, such as `aprox. 18 dias`, remains visible in the
balance cell and accessible name. Add light and dark semantic tier tokens to
`src/styles/index.css`, but treat the text label as the required non-hue
channel. A row must remain understandable in grayscale and forced-colors mode.

### Day detail

Add `/app/day/$date?month=YYYY-MM`. An invalid date replaces the URL with the
current month workspace. A valid deep link loads the balance row and that
owner's transactions for the day through feature services.

The detail shows opening balance, movements, closing balance, runway, and a
transaction list. A future day with projection shows a separate `Diário
previsto` explanation and links to `Ajustar diário`. The projected amount is
never rendered as a transaction row.

The week strip starts on Sunday and contains seven 44 by 44 day links. It may
span two months and therefore queries each distinct month represented in the
week, at most two. Every available day shows a tier dot and an accessible tier
label. The selected day uses text, border, and `aria-current="date"`, not color
alone.

Reuse the existing transaction row treatment instead of building another
transaction card. Add a direct day query so a deep link does not download the
whole month. An empty day offers `Adicionar lançamento` with the selected date
pre-filled. Edit and back links preserve the selected month.

### Offline and failure behavior

The daily setup form remains editable offline but cannot confirm. The ledger
and day detail replace financial values with an online-required state when
offline. They do not render stale cached financial data as current.

A failed setting read does not mean `not configured`. A failed balance read
does not mean an empty month. All failure states offer retry, keep logout
reachable through the existing chrome when applicable, and avoid logging
financial payloads.

## Delivery steps

### 1. Establish the daily-spending database boundary

Status: complete

Observed: `bunx supabase db reset` applied
`20260902010000_daily_spending_settings.sql` after the four migrations already
on `main`. `bunx supabase test db` passed at `Files=3, Tests=106`, with
`daily_spending_test.sql` contributing `plan(29)`. `bun run db:types`
regenerated `daily_spending_settings` and `set_daily_spending`, and
`bunx tsc --noEmit`, `bun run check`, and `git diff --check` were clean.

Two contract corrections came out of implementation. A missing row cannot be
locked by `select ... for update`, so two tabs creating the setting at the same
instant raised a raw `23505` unique violation instead of the documented
`PT409:daily_spending_conflict`; the insert now absorbs the collision with
`on conflict (user_id) do nothing` and falls through to the existing-row rules,
matching `initialize_starting_position`. `daily_amount_cents` was also
declared `not null`, because the type generator otherwise emits
`number | null` for a generated column and step 2 would carry a null branch
that the schema cannot produce.

`bun run test` passed at 292 Vitest tests. One unrelated pre-existing flake
appeared in roughly one run out of five:
`forgot-password-page.test.tsx` → `should request recovery with a trimmed email
and current origin callback`. It predates this branch and is not caused by this
step.

Create:

- `supabase/migrations/20260902010000_daily_spending_settings.sql`;
- `supabase/tests/database/daily_spending_test.sql`.

Update:

- `src/lib/supabase/database.types.ts` through `bun run db:types`;
- `docs/finance-rules.md` with the table, RPC, grants, wire fields, integer
  division, idempotency, conflict, and errors.

Implement the table, generated daily amount, constraints, owner-only read RLS,
revoked direct writes, and `set_daily_spending`. Keep every historical
migration unchanged.

Acceptance criteria:

- an authenticated user creates zero or positive settings and reads only their
  own row;
- category-mode and direct-mode normalized inputs produce the expected integer
  daily amount;
- an identical create retry returns one row;
- a conflicting create or stale edit returns `PT409` without changing data;
- a valid edit returns a strictly newer version;
- invalid amount and divisor values fail with stable `22023` messages;
- anonymous access fails and another user sees no row;
- generated TypeScript types reproduce the local schema.

Validation:

```bash
bunx supabase db reset
bunx supabase test db supabase/tests/database/daily_spending_test.sql
bun run db:types
git diff --check
```

Proposed commit:

```text
feat: add daily spending settings
```

### 2. Deliver the daily-target setup and edit flow

Create:

- `src/features/daily-spending/daily-spending-types.ts`;
- `src/features/daily-spending/daily-spending-service.ts` and test;
- `src/features/daily-spending/daily-spending-queries.ts`;
- `src/features/daily-spending/daily-spending-mutations.ts` and test;
- `src/features/daily-spending/daily-spending-schema.ts` and test;
- `src/features/daily-spending/daily-spending-errors.ts` and test;
- `src/features/daily-spending/daily-spending-form.tsx` and test;
- `src/features/daily-spending/daily-spending-page.tsx` and test;
- `src/routes/_authenticated._positioned.app_.daily-spending.tsx`;
- `tests/e2e/daily-spending.spec.ts`.

Update:

- `src/routes/_authenticated.onboarding.tsx` so a newly saved position offers
  daily setup next;
- `src/routeTree.gen.ts` through the router plugin;
- `tests/e2e/onboarding.spec.ts` for continue, skip, reload, and return paths;
- `tests/e2e/support/finance-admin.ts` with a loopback-only daily-setting
  fixture.

Use the existing BRL parser, calendar helpers, unsaved-changes boundary,
offline hook, query client, and full-page form conventions. Do not add Zustand
or persist category inputs.

Acceptance criteria:

- after saving a starting position, a new user reaches optional daily setup;
- skipping creates no row and reaches the selected month;
- five monthly estimates produce a reviewed total and server-derived daily
  value;
- the direct path preserves the exact daily value after normalization;
- the page states that category estimates are not saved as category budgets;
- reload reads the authoritative setting, and edit updates it;
- stale edit keeps the draft and offers an explicit reload;
- offline confirmation is disabled without losing fields;
- abandoning a dirty form triggers the existing discard behavior;
- existing users without a setting still reach `/app`;
- controls retain accessible names, focus rings, and 44 by 44 targets at
  `375×667` and `1280×800`.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test -- src/features/daily-spending
bun run test:e2e:local -- daily-spending onboarding
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]' || true
```

Proposed commit:

```text
feat: add daily spending setup
```

### 3. Implement and prove the monthly balance RPC

Create:

- `supabase/migrations/20260902020000_month_balance.sql`;
- `supabase/tests/database/month_balance_test.sql`;
- `scripts/measure-month-balance.sql`.

Update:

- `src/lib/supabase/database.types.ts` through `bun run db:types`;
- `docs/finance-rules.md` with the exact calculation, nullability, date rules,
  result fields, authorization, and error contract.

The measurement script creates a disposable owner and transactions inside a
transaction, runs `EXPLAIN (ANALYZE, BUFFERS)` for current and future months,
and rolls back. Record actual planning time, execution time, returned rows,
buffer reads, and index use in this document when the step closes. Do not set a
made-up latency target and do not add a cache based only on fixture timing.

Acceptance criteria:

- the RPC returns 28, 29, 30, or 31 ordered rows as appropriate;
- the opening position, same-day movements, all four kinds, and carry-forward
  produce exact centavo values;
- days before `effective_on` return null balances without hiding movements;
- past and current days never contain daily projection;
- future days project only the unrecorded part of the daily target;
- missing and zero settings project zero and remain distinguishable outside
  the RPC through the setting query;
- a future month carries recorded and projected movements before its first day;
- another user's position, setting, and transactions never affect the result;
- anonymous execution, missing position, invalid month, and unsafe aggregate
  fail safely;
- December 9999 does not overflow into year 10000;
- the local query measurement is recorded before any index or cache proposal.

Validation:

```bash
bunx supabase db reset
bunx supabase test db supabase/tests/database/month_balance_test.sql
bun run db:types
psql postgresql://postgres:postgres@127.0.0.1:54322/postgres -v ON_ERROR_STOP=1 -f scripts/measure-month-balance.sql
git diff --check
```

Proposed commit:

```text
feat: calculate daily month balances
```

### 4. Add the balance client and local-day rollover

Create:

- `src/features/balance/balance-types.ts`;
- `src/features/balance/balance-service.ts` and test;
- `src/features/balance/balance-queries.ts` and test;
- `src/features/balance/balance-errors.ts` and test;
- `src/features/balance/balance-runway.ts` and test;
- `src/lib/use-local-today.ts` and test.

Update:

- `src/features/daily-spending/daily-spending-mutations.ts` so setting changes
  invalidate every user-scoped balance query.

Keep Supabase calls inside services. Pass `AbortSignal`, use the generated RPC
types, and do not recompute server-owned balances in React. Runway and labels
are presentation logic and remain in the frontend.

Acceptance criteria:

- the service calls `get_month_balance` with month start and device-local
  today, accepts the ordered wire result, and propagates safe errors;
- query keys isolate users, months, and local dates;
- a setting change invalidates only that user's balance family;
- runway labels cover missing, zero, negative, and every positive band;
- local midnight changes the returned date and therefore the balance query;
- returning to a suspended tab after midnight corrects the date;
- unmount removes timers and visibility listeners.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test -- src/features/balance src/features/daily-spending/daily-spending-mutations.test.tsx src/lib/use-local-today.test.ts
bun run build
```

Proposed commit:

```text
feat: add the monthly balance client
```

### 5. Deliver the selected-day detail

Create:

- `src/features/balance/balance-week-strip.tsx` and test;
- `src/features/balance/day-detail-page.tsx` and test;
- `src/routes/_authenticated._positioned.app_.day.$date.tsx`;
- `tests/e2e/day-detail.spec.ts`.

Update:

- `src/features/transactions/transaction-service.ts` and test with an
  owner-scoped day read;
- `src/features/transactions/transaction-queries.ts` with the day query key;
- `src/features/transactions/transaction-list.tsx` and test to render the
  existing rows in one selected day without a redundant month grouping;
- create and edit transaction pages, route search schemas, and tests with a
  validated originating day, pre-filled date, and day-detail return path;
- `src/routeTree.gen.ts` through the router plugin.

Acceptance criteria:

- a valid deep link loads only caller-owned balance and transaction data;
- invalid dates return to the current month without a broken screen;
- the week strip has seven days, crosses a month boundary, and identifies its
  selected day without relying on color;
- each available week day exposes its tier through dot and accessible label;
- opening balance, movements, closing balance, and runway match the RPC;
- a future day explains the daily projection separately from transactions;
- an empty day can open a new transaction with that date pre-filled;
- cancel returns to the originating day, while a successful create or edit
  returns to the date the server persisted;
- delete returns to the originating day and preserves the month context;
- malformed day search values cannot become an external or arbitrary return
  destination;
- offline, loading, not-found, and error states remain actionable.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test -- src/features/balance src/features/transactions
bun run test:e2e:local -- day-detail transactions
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]' || true
```

Proposed commit:

```text
feat: add the daily balance detail
```

### 6. Replace monthly history with the daily ledger

Create:

- `src/features/balance/balance-summary.tsx` and test;
- `src/features/balance/balance-day-row.tsx` and test;
- `src/features/balance/balance-ledger.tsx` and test;
- `src/features/balance/balance-page.tsx` and test;
- `tests/e2e/balance.spec.ts`.

Update:

- `src/app/authenticated-app-page.tsx` and test;
- `src/features/transactions/month-selector.tsx` only if the observed today
  navigation requires a new callback;
- `src/styles/index.css` with semantic balance-tier tokens;
- `tests/e2e/transactions-read.spec.ts` so it enters transaction history
  through a day rather than expecting it on the month screen.

Remove `src/features/transactions/transactions-page.tsx` and its test when no
route or component consumes the monthly history. Preserve the transaction row
UI now used by the day detail.

Acceptance criteria:

- `/app` renders the appropriate summary and one row for every day;
- selecting a ledger row opens the exact calendar date in the delivered day
  detail;
- exact totals and closing balances survive reload;
- days with no movement remain visible;
- a month with no movement shows its inline message and all calendar rows;
- future projection is labeled and never presented as a saved transaction;
- no-setting, zero-setting, before-position, loading, error, offline, current,
  future, and negative states have distinct copy;
- every balance tier remains understandable without hue;
- current-month load reveals today once, and the `Hoje` pill follows actual
  row visibility;
- another month uses `Hoje` to return to the current month;
- the first and final rows clear the floating chrome and safe areas;
- light and dark layouts at `375×667` and `1280×800` have no horizontal
  overflow, clipped amount, hidden focus ring, or undersized target.

Validation:

```bash
bun run check
bunx tsc --noEmit
bun run test -- src/app/authenticated-app-page.test.tsx src/features/balance
bun run test:e2e:local -- balance day-detail transactions-read
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]' || true
```

Proposed commit:

```text
feat: render the daily balance ledger
```

### 7. Connect mutation invalidation and close the feature

Update:

- `src/features/transactions/transaction-mutations.ts` and test;
- create, edit, and delete pages and tests where `originalDate` or return
  navigation must be carried;
- transaction E2E files for ledger and day-detail destinations;
- `docs/architecture.md` with settings, RPC, query keys, rollover, carry, and
  cache rules;
- `docs/authentication.md` with optional daily setup after the starting
  position;
- `docs/finance-rules.md` with final observed behavior and errors;
- `docs/implementation-plan.md` with delivered commits and observed checks;
- this file with exact test counts, measurement results, visual observations,
  and deferred hosted or physical-device checks.

Acceptance criteria:

- create refreshes the affected day and every cached balance month for the
  user before navigation completes;
- moving a transaction refreshes the old day, new day, and carried balances;
- delete removes the transaction from its day and every later balance after a
  reload;
- setting edits refresh future projections without changing past or current
  daily values;
- no other user's query key or data is invalidated or displayed;
- the complete local gate passes on the final branch tip;
- generated types are reproducible and every historical migration is intact;
- the measured query result is recorded and no unproven cache is added;
- the built service worker contains no Supabase, Auth, or financial runtime
  cache;
- no avoidable bracket-syntax Tailwind class or Playwright artifact remains;
- documentation distinguishes observed checks from hosted and device checks.

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
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]' || true
! rg -q 'supabase' dist/sw.js
```

Stop the local stack only if this work started it:

```bash
bunx supabase stop --no-backup
```

Proposed commit:

```text
docs: close daily balance delivery
```

## Final merge gate

Before opening the pull request:

- confirm the branch starts at `main` containing merge `149d1b9`;
- inspect `git status`, every branch commit, and the complete diff from `main`;
- rerun delivery step 7 on the final tip;
- verify both new migrations apply after the four migrations already in
  `main` and that no old migration changed;
- verify settings and balance RPCs derive ownership from `auth.uid()` and
  expose no user-ID argument;
- verify anonymous denial and cross-user isolation for the new table and
  functions;
- verify balance arithmetic against deterministic `p_today` cases;
- verify the build contains no service-role credential, financial fixture, or
  runtime financial cache;
- inspect the daily calculator, ledger, tiers, today behavior, and day detail
  at mobile and desktop sizes in light and dark;
- request explicit authorization before pushing, opening a pull request,
  creating hosted data, or deploying.

The pull request squash commit is:

```text
feat: add daily spending and balance ledger
```

## Deferred hosted and device checks

These checks remain under roadmap step 10 and do not block local delivery:

- apply the new migrations to an approved non-production Supabase project only
  after the compatible frontend is deployed;
- create and edit a non-sensitive daily setting through a Deploy Preview;
- observe the month RPC through the hosted Data API and inspect logs for
  credentials or financial payloads;
- verify midnight rollover by changing device time in a disposable test
  environment;
- inspect category inputs, numeric keyboard, today scrolling, long ledger,
  week strip, safe areas, offline behavior, and controlled PWA update on a real
  iPhone and Android device;
- remove disposable hosted users and rows through an authorized admin path.

No production financial write belongs to feature verification without a
separate explicit decision.

## Behavioral references inspected

- `legacy/finance-app/app/(onboarding)/index.tsx` for the assisted and direct
  entry choice;
- `legacy/finance-app/app/(onboarding)/[step].tsx` for the five routine-spending
  estimates;
- `legacy/finance-app/app/(onboarding)/resumo.tsx` for monthly-total division;
- `legacy/finance-app/src/components/balance/DayRow.tsx` for daily-ledger
  information hierarchy;
- `legacy/finance-app/app/day/[date].tsx` for day-detail projection copy;
- `legacy/finance-api/cmd/api/auth.go` for the legacy daily-budget calculation;
- `legacy/finance-api/cmd/api/balance.go` for carry-forward and future
  projection semantics;
- `legacy/finance-web-app/src/lib/finance.ts` for runway bands.

These files are behavioral references only. The new migrations, RPCs, wire
types, routes, and release remain independent.
