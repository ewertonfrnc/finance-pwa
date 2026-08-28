# Transaction kinds implementation plan

Status: implemented locally on 2026-08-27; hosted rollout and the runtime
visual pass remain open

Last reviewed: 2026-08-27

Roadmap step: 6

Delivery branch: `feat/transaction-kinds`

## Outcome

Let a signed-in user create, read, edit, and delete one-time transactions of
four kinds: `income`, `expense`, `daily`, and `savings`. Each kind has its own
Portuguese label, category mark, light and dark color triple, and documented
effect on available balance.

This step also replaces the application-level `40001` conflict error that
PostgREST 14.17 retries indefinitely. The replacement keeps conflict recovery
observable and allows the transaction E2E gate to finish.

## Starting point

The following exists on `main` at `c1c0469` and must be preserved:

- `public.transaction_kind` contains only `income` and `expense` in
  `supabase/migrations/20260825010000_database_foundation.sql`;
- `create_transaction` and `update_transaction` already accept
  `public.transaction_kind`, so widening the enum does not require a new RPC
  signature;
- create derives ownership from `auth.uid()` and uses the client UUID as its
  idempotency key;
- update and delete lock the caller-owned row and compare `updated_at` before
  mutating it;
- authenticated users have read-only table access and use the three mutation
  RPCs for writes;
- `TransactionKind` derives from the generated database type rather than a
  handwritten union;
- the form, list, and delete dialog assume there are exactly two kinds and
  duplicate part of their label and visual metadata;
- `src/styles/index.css` already owns the income and expense category triples;
- the transaction form defaults to `expense`;
- the complete non-conflict transaction E2E paths pass in mobile and desktop
  Chromium;
- the four stale update/delete E2E variants time out because local PostgREST
  14.17 retries the RPC transaction after its application-level `40001`.

The migrations above have reached `main`. This plan adds forward migrations
and never edits them.

## Scope

Include:

- a forward enum migration that appends `daily` and `savings`;
- generated TypeScript types from the widened local schema;
- server rejection of any kind outside the four enum values;
- one feature-owned source for kind order, labels, signs, explanatory copy,
  color classes, and category marks;
- four options in create and edit forms;
- four-kind rendering in the transaction list and delete dialog;
- light and dark category triples copied from the shipped legacy application;
- pgTAP, Vitest, and Playwright coverage for the expanded behavior;
- a forward correction from `40001` to `PT409` for optimistic concurrency
  conflicts;
- documentation of kind semantics, the corrected error contract, observed
  verification, and rollout order.

Exclude:

- the daily balance ledger and any balance aggregation RPC;
- implementation of the future daily projection;
- recurrence, tags, category budgets, transfers, and a balance cache;
- changing the create form's default from `expense`;
- changing transaction query keys, pagination, cache invalidation, routes, or
  service-worker behavior;
- a new icon or component-library dependency;
- editing historical migrations or rewriting previously observed plan records.

## Decisions

### Enum order and wire contract

Append the new enum labels in this order:

```text
income, expense, daily, savings
```

The migration uses `alter type public.transaction_kind add value` and contains
no transaction-row update. PostgreSQL preserves existing `income` and
`expense` rows because the operation changes the enum catalog rather than the
stored value.

The new labels must not be used by another statement in the same migration
transaction that adds them. PostgreSQL makes the labels available after that
transaction commits. RPC and pgTAP use of the labels happens after migration
application.

An unsupported wire value such as `transfer` fails while PostgreSQL casts the
RPC argument to `public.transaction_kind`. The stable code is `22P02`; no
application fallback or compatibility label is added.

### Kind semantics

Persist every amount as a positive magnitude. Kind determines the direction
and category:

| Kind      | Label    | Available-balance effect | Category meaning                            |
| --------- | -------- | ------------------------ | ------------------------------------------- |
| `income`  | Entrada  | Adds the amount          | Money received                              |
| `expense` | Saída    | Subtracts the amount     | Point expense                               |
| `daily`   | Diário   | Subtracts the amount     | Routine daily spending                      |
| `savings` | Economia | Subtracts the amount     | Value reserved outside the expense category |

Only `income` displays `+`; the other three kinds display the Unicode minus
already included in the monetary font subset.

`daily` participates in the daily projection contract delivered in roadmap
step 8. `savings` reduces available balance but is not reclassified as
`expense`. Step 6 documents these rules and renders the categories; it does not
calculate a balance.

### Form copy and marks

Use the enum order `income`, `expense`, `daily`, `savings` wherever all four
kinds are offered. Keep `expense` as the create default because changing
the default to the legacy application's `daily` would be a separate behavior
change.

| Kind      | Footnote                                           | Description placeholder      | Mark                     |
| --------- | -------------------------------------------------- | ---------------------------- | ------------------------ |
| `income`  | `Aumenta o saldo do dia.`                          | `De onde veio essa grana?`   | Up arrow                 |
| `expense` | `Reduz o saldo do dia como gasto pontual.`         | `Onde foi parar essa grana?` | Down arrow               |
| `daily`   | `Conta como gasto diário da rotina.`               | `Onde foi parar essa grana?` | Banknote with down arrow |
| `savings` | `Reserva valor e também reduz o saldo disponível.` | `Onde foi parar essa grana?` | Piggy bank               |

Implement the marks as local SVG paths. Do not add Lucide or copy React Native
runtime code from the legacy application.

### Category tokens

Copy the shipped values from
`legacy/finance-app/src/lib/designTokens.ts`, not the stale design-system HTML:

| Scheme | Kind      | Dot       | Soft background | Ink       |
| ------ | --------- | --------- | --------------- | --------- |
| Light  | `daily`   | `#a623cd` | `#f6ddff`       | `#6c1984` |
| Light  | `savings` | `#7cab2d` | `#edf7db`       | `#4d7014` |
| Dark   | `daily`   | `#9f4bc0` | `#3d2548`       | `#f8eaff` |
| Dark   | `savings` | `#779f47` | `#303d25`       | `#f4ffe8` |

Expose them through `@theme inline` as named Tailwind colors. Components use
canonical classes such as `bg-daily-soft`, `text-daily`, and
`text-savings-ink`; they do not repeat color literals or use arbitrary-value
syntax.

### One exhaustive feature mapping

Create `src/features/transactions/transaction-kind.tsx` as the shared owner of:

- the ordered kind list sourced from generated
  `Constants.public.Enums.transaction_kind`;
- one exhaustive `Record<TransactionKind, ...>` containing labels, footnotes,
  placeholders, signs, and named color classes;
- the reusable category icon and dot renderers.

This removes the current duplicate records from `transaction-form.tsx`,
`transaction-list.tsx`, and `delete-transaction-dialog.tsx`. The generated enum
remains the type and runtime source of truth; the feature mapping owns only
product presentation.

### Conflict error contract

`40001` means `serialization_failure` to PostgreSQL. PostgREST 14.17 retries
that transaction, so an application-level stale-version error never returns to
the browser and the E2E request times out. PostgREST merged an upstream fix on
2026-04-27, but the local version does not contain it and hosted rollout timing
is outside this repository's control.

Replace only the stale-version raises in `update_transaction` and
`delete_transaction` with:

```sql
raise sqlstate 'PT409' using message = 'transaction_conflict';
```

PostgREST documents `PTxyz` as the stable way for a function to choose an HTTP
status. `PT409` returns HTTP 409, keeps `transaction_conflict` as the message,
and is not treated as a serialization failure.

The browser recognizes both `PT409` and `40001` during rollout. `PT409` is the
canonical contract after this step; `40001` remains only as temporary frontend
compatibility for an environment that has received the frontend but not the
database migration.

Recreate the two functions through `create or replace function` in a separate
forward migration. Preserve their signatures, validation, owner derivation,
row locks, `security definer`, empty `search_path`, return rows, and grants.

### Rollout order

The safe hosted order is:

1. apply the enum migration `20260827010000_widen_transaction_kinds.sql` to the
   approved Supabase environment. This is compatible with the old frontend,
   which continues to send and render only `income` and `expense`;
2. deploy the frontend that recognizes `PT409` and `40001` and exposes `daily`
   and `savings`;
3. confirm the deployed commit is active;
4. apply the conflict migration `20260827020000_use_http_conflict_sqlstate.sql`;
5. verify a stale update and delete return HTTP 409 with
   `PT409:transaction_conflict` and that creating `daily` and `savings`
   succeeds.

Deploying the final squash artifact before step 1 would expose `daily` and
`savings` while the production enum still accepts only `income` and `expense`.
Any user choosing a new kind during that gap receives `22P02` and cannot save
the transaction. The enum migration must go first, or the rollout must use a
compatibility-only frontend artifact for step 2 that recognizes `PT409`/`40001`
without exposing the new kinds. Applying the conflict migration before the
dual-code frontend would temporarily turn a recoverable conflict into generic
UI copy.

Deployment, hosted database writes, and hosted smoke tests require explicit
user authorization. Local completion does not imply those checks ran.

## Delivery steps

Each step is one focused commit on `feat/transaction-kinds`. The branch is
squash-merged as `feat: widen the transaction kinds` after the full local gate
passes.

### 1. Widen the database enum and document its semantics

Status: complete

Observed: `bunx supabase db reset` applied the new migration and
`enum_range(null::public.transaction_kind)` returned
`{income,expense,daily,savings}`. `bunx supabase test db` passed at `Files=2,
Tests=77`, with `transaction_mutations_test.sql` raised from `plan(52)` to
`plan(58)`. The upgrade rehearsal from `20260825020000` produced the identical
digest `0c8bf1e882f927606577389557384dc2` before and after `migration up`, so
no seeded row changed. A `transfer` cast failed with `22P02` and inserted no
row.

The validation list for this step omitted `bun run check`, and the Prettier
violation it would have caught in `docs/finance-rules.md` surfaced only during
step 2. Later steps ran the formatter check.

Create:

- `supabase/migrations/20260827010000_widen_transaction_kinds.sql`: append
  `daily` and `savings` to `public.transaction_kind` and replace the table
  comment so it describes four one-time transaction kinds. Do not mutate rows
  or use the new labels before the migration commits.

Update:

- `supabase/tests/database/data_boundary_test.sql`: expect the exact enum range
  `{income,expense,daily,savings}`;
- `supabase/tests/database/transaction_mutations_test.sql`: prove create
  persists `daily` and `savings`, update changes a row to a new kind, delete
  returns a row with a new kind, and an unknown cast fails with `22P02`; update
  the pgTAP plan to the exact assertion count;
- `docs/finance-rules.md`: replace the binary kind contract with the four-row
  semantics table, positive-magnitude direction rules, daily projection rule,
  savings rule, and unknown-enum outcome.

Acceptance criteria:

- a clean local reset exposes exactly `income`, `expense`, `daily`, and
  `savings` in that order;
- authenticated mutation RPC calls persist and return both new kinds without
  weakening ownership or direct-write denial;
- a PostgreSQL call carrying `transfer` fails with `22P02` before inserting a
  row;
- an upgrade rehearsal starts from migration `20260825020000`, records the
  complete seeded transaction rows, applies pending migrations, and observes
  the exact same rows afterwards.

Validation:

```bash
bunx supabase start
bunx supabase db reset
bunx supabase test db
```

Upgrade rehearsal:

```bash
bunx supabase db reset --version 20260825020000
before="$(docker exec supabase_db_finance-pwa psql -U postgres -d postgres -Atc "select md5(coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb)::text) from public.transactions as t")"
bunx supabase migration up --local
after="$(docker exec supabase_db_finance-pwa psql -U postgres -d postgres -Atc "select md5(coalesce(jsonb_agg(to_jsonb(t) order by id), '[]'::jsonb)::text) from public.transactions as t")"
test "$before" = "$after"
```

Proposed commit:

```text
feat: widen transaction kind enum
```

### 2. Return optimistic conflicts without PostgREST retries

Status: complete

Observed: `bun run test:e2e:local -- transactions-edit transactions-delete`
passed at 12 cases. The two previously blocked conflict variants returned once
each, in 3.3 and 4.3 seconds for the stale update and 4.4 and 4.3 seconds for
the stale delete, instead of exhausting the timeout. `bunx supabase test db`
passed at `Files=2, Tests=77` with `plan(58)` unchanged, since the two
`throws_ok` assertions only swapped `40001` for `PT409`. The three targeted
Vitest files passed at 46 tests.

Create:

- `supabase/migrations/20260827020000_use_http_conflict_sqlstate.sql`: recreate
  `update_transaction` and `delete_transaction` unchanged except for replacing
  stale-version `40001` raises with `PT409`.

Update:

- `supabase/tests/database/transaction_mutations_test.sql`: expect `PT409` for
  stale update and delete while retaining the assertions that the newer rows
  survive;
- `src/features/transactions/transaction-errors.ts`: make `PT409` canonical and
  recognize both `PT409` and `40001` as the same recoverable conflict during
  rollout;
- `src/features/transactions/transaction-errors.test.ts`: cover canonical,
  compatibility, wrong-message, and unrelated-error cases;
- `src/features/transactions/transaction-service.test.ts`: use the canonical
  provider error in update and delete fixtures and prove it passes through for
  safe UI mapping;
- `src/features/transactions/edit-transaction-page.test.tsx`: use `PT409` in
  the update and delete conflict scenarios while preserving the recovery UI
  assertions;
- `docs/finance-rules.md`: document HTTP 409 and `PT409` as the current conflict
  contract, with `40001` noted only as rollout compatibility;
- `docs/plans/04-one-time-transactions.md` and
  `docs/plans/05-design-system-ios.md`: preserve their original `40001`
  observations and add a dated forward-fix note rather than rewriting history.

Acceptance criteria:

- a stale update and stale delete each return once, within the normal E2E
  timeout, as HTTP 409 with `PT409:transaction_conflict`;
- update keeps the typed draft and offers `Recarregar lançamento`;
- delete keeps its dialog open and offers the same recovery action;
- reloading the authoritative row and retrying still completes the mutation;
- authorization, not-found behavior, RPC signatures, grants, and direct-write
  denial are unchanged.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bunx vitest run src/features/transactions/transaction-errors.test.ts src/features/transactions/transaction-service.test.ts src/features/transactions/edit-transaction-page.test.tsx
bun run test:e2e:local -- transactions-edit transactions-delete
```

Proposed commit:

```text
fix: return transaction conflicts without retries
```

### 3. Deliver the four-way transaction control and category visuals

Status: complete

Observed: `bun run db:types` produced all four values in both the union and
`Constants`, and repeated runs held the digest stable. `bun run check`,
`bunx tsc --noEmit`, and `bun run build` passed; `bun run test` passed at 27
files and 233 tests. The arbitrary-value grep over added `.tsx` and `.css`
lines returned no match. Exhaustiveness was proven by deleting the `savings`
entry and observing `TS2741`, then restoring it.

Create:

- `src/features/transactions/transaction-kind.tsx`: exhaustive metadata and
  shared inline SVG category marks for the four generated kinds.

Update:

- `src/lib/supabase/database.types.ts`: regenerate from the local database so
  both the union and `Constants` contain all four values; do not edit this file
  manually;
- `src/features/transactions/transaction-form-schema.ts`: validate membership
  in the generated four-kind list while continuing to reject a typed-boundary
  bypass such as `transfer`;
- `src/features/transactions/transaction-form.tsx`: render all four radio
  options and consume the shared label, footnote, placeholder, dot, and mark;
- `src/features/transactions/transaction-list.tsx`: render each label,
  no-description fallback, sign, ink token, and category mark from the shared
  metadata;
- `src/features/transactions/delete-transaction-dialog.tsx`: replace the loose
  `Record<string, string>` fallback with the exhaustive shared label;
- `src/styles/index.css`: expose the `daily` and `savings` triples in light and
  dark without changing existing category or danger colors;
- `src/features/transactions/transaction-form-schema.test.ts`: accept every
  generated kind and retain the unsupported-kind case;
- `src/features/transactions/transaction-form.test.tsx`: observe four radio
  names, new explanatory copy, focus return, and a submitted new-kind payload;
- `src/features/transactions/transaction-list.test.tsx`: render all four kinds
  and assert their visible labels, fallback descriptions, signs, and formatted
  amounts;
- `src/features/transactions/delete-transaction-dialog.test.tsx`: cover
  `Diário sem descrição` and `Economia sem descrição`;
- `src/features/transactions/create-transaction-page.test.tsx`: select a new
  kind and observe it in the service input;
- `src/features/transactions/edit-transaction-page.test.tsx`: open a persisted
  new kind, change kind, and observe it in the update input.

`src/features/transactions/transaction-service.ts`, mutation hooks, query
options, routes, and cache invalidation need no production change because their
types and payloads already flow through `TransactionKind`.

Acceptance criteria:

- create and edit screens expose four accessible radio options with the exact
  labels `Entrada`, `Saída`, `Diário`, and `Economia`;
- selecting each option updates the visible label, explanatory copy,
  placeholder, dot, and category mark without losing the current draft;
- a transaction row visibly distinguishes all four kinds by label, sign, mark,
  and category ink in light and dark mode;
- a missing description produces the correct localized fallback for every
  kind;
- the create form still opens as `Saída` and the existing unsaved, offline,
  pending, focus, create-idempotency, update, and delete behavior remains;
- TypeScript fails exhaustiveness if a generated enum value has no product
  metadata.

Validation:

```bash
bun run db:types
bun run check
bunx tsc --noEmit
bun run test
bun run build
git diff --unified=0 -- '*.tsx' '*.css' | rg '^\+.*[-:]\[[^]]+\]'
```

The final command should return no newly added arbitrary-value Tailwind class
that has a canonical or named-token equivalent. Inspect any legitimate match
instead of treating grep alone as a lint result.

After the generated type change is staged in this step, run the generation
again and require no diff:

```bash
bun run db:types
git diff --exit-code -- src/lib/supabase/database.types.ts
```

Proposed commit:

```text
feat: add four-way transaction type control
```

### 4. Prove the four kinds through the local Data API and browser

Status: complete for the assertable criteria; the runtime visual pass was not
performed

Observed: `bun run test:e2e:local -- transactions` passed at 22 cases, 11 per
project. New coverage creates all four kinds through the form and survives a
reload, rejects an authenticated `transfer` RPC with `22P02` without inserting
a row, changes a transaction to a new kind across a reload, and names
`Diário sem descrição` in the delete dialog. `playwright.config.ts` was left
alone: the mobile project runs at 375 by 667, so the 390 by 844 criterion is
asserted with `setViewportSize` inside the spec and the viewport is restored
afterwards. Horizontal overflow, the 44 by 44 minimum target, and four distinct
computed background colors are asserted in code.

Not observed: the rendered SVG marks and their light and dark contrast. A
distinct `getComputedStyle` value is not a substitute for looking at the
screen, and this plan does not claim that check ran. It moves to the device and
browser pass owned by roadmap step 10.

A first run failed both new kind-change cases because the trigger locator was
pinned to `Tipo: Saída` while its accessible name becomes `Tipo: Economia` on
selection. The locator now matches `/^Tipo: /`. That was a test defect, not a
product defect.

Update:

- `tests/e2e/transactions-create.spec.ts`: create one transaction of each kind
  through the signed-in form, reload, and observe every description, label,
  sign, and amount; issue an authenticated RPC with `transfer` through a
  local-only Supabase client and assert `22P02` with no inserted row;
- `tests/e2e/transactions-read.spec.ts`: add `daily` and `savings` fixtures and
  observe all four labels in light and dark mode without cross-user leakage or
  horizontal overflow;
- `tests/e2e/transactions-edit.spec.ts`: change an existing transaction to a
  new kind and observe it after reload; keep the now-unblocked stale update
  recovery case;
- `tests/e2e/transactions-delete.spec.ts`: keep the now-unblocked stale delete
  recovery case and use a new-kind row where useful to prove the delete dialog
  names it correctly;
- `tests/e2e/support/finance-admin.ts`: add `kind` to
  `LocalTransactionUpdate` only if a conflict scenario changes kind from the
  simulated second device.

Acceptance criteria:

- one signed-in user creates all four kinds through the UI and sees every row
  unchanged after a full reload;
- the invalid direct request returns `22P02` and creates no transaction;
- another user's rows remain absent;
- editing to `daily` or `savings` survives reload;
- stale update and delete recover instead of timing out in both Playwright
  projects;
- at 390 by 844 and 1280 by 800 CSS pixels, the expanded picker and rows have
  no horizontal overflow, every interactive target remains at least 44 by 44
  CSS pixels, and all four marks are visually distinct in light and dark.

Validation:

```bash
bunx supabase db reset
bunx supabase test db
bun run test:e2e:local -- transactions
```

Runtime check: use the production build generated by the local E2E launcher to
inspect create, list, edit, and delete at both widths and in both color schemes.
Confirm the four marks, labels, signs, focus ring, picker height, final-row
visibility, and absence of horizontal overflow. Save no screenshot artifact in
the repository and stop any server started for inspection.

Proposed commit:

```text
test: verify all transaction kinds end to end
```

### 5. Close the roadmap step

Status: complete

Observed: `docs/architecture.md` now states the four kinds, their direction
rules, and the `transaction-kind.tsx` presentation boundary.
`docs/implementation-plan.md` records step 6 with the observed counts and the
deferred visual and hosted checks. Final tip validation is recorded under
"Final merge gate" below.

Update:

- `docs/architecture.md`: replace the binary transaction-kind statement and
  record the shared feature metadata boundary;
- `docs/implementation-plan.md`: mark step 6 complete only after all local
  checks and runtime observations finish; record the enum migration, generated
  types, four-way UI, category tokens, conflict correction, test counts, and
  any hosted checks that remain deferred;
- `docs/plans/06-transaction-kinds.md`: replace pending statuses with observed
  results, exact commands, counts, runtime matrix, commit hashes, and remaining
  hosted rollout work.

Acceptance criteria:

- every roadmap step 6 acceptance criterion has a corresponding observed
  database, browser, or generation result;
- historical records still state that `40001` timed out when originally
  observed and point to the dated forward correction;
- documentation does not claim a hosted migration, deployment, or device check
  that was not performed;
- the worktree contains no generated Playwright artifact or changed
  `report.html` from this validation.

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

Stop the local stack if this work started it:

```bash
bunx supabase stop --no-backup
```

Proposed commit:

```text
docs: close transaction kinds delivery
```

## Final merge gate

Before opening the pull request:

- confirm every delivery step is committed and this plan records only observed
  results;
- inspect `git status`, the complete diff from `main`, and every branch commit;
- rerun the complete validation from delivery step 5 on the final branch tip;
- verify the generated database type is reproducible;
- verify new TSX and CSS lines contain no avoidable bracket-syntax Tailwind
  utilities;
- verify the production build contains no Supabase service-role credential or
  financial payload;
- verify the service worker still has no runtime cache for Supabase, Auth, or
  financial data;
- request explicit authorization before pushing migrations to a hosted project
  or creating hosted financial data.

The pull request squash commit is:

```text
feat: widen the transaction kinds
```

## Deferred hosted checks

These checks do not block local implementation and remain explicit until the
user authorizes external effects:

- apply the enum migration `20260827010000` to `finance-pwa-dev` and then the
  approved production project before exposing `daily` and `savings`;
- deploy the dual-code frontend (recognizes `PT409`/`40001`, exposes four
  kinds) and confirm the commit is active;
- apply the conflict migration `20260827020000`;
- observe `PT409` and HTTP 409 through each hosted Data API;
- create and reload the four kinds in a Deploy Preview connected only to the
  development Supabase project;
- review Netlify and Supabase logs for credentials and financial payloads;
- complete the physical Android and iPhone transaction pass assigned to
  roadmap step 10.

## References

- [`../implementation-plan.md`](../implementation-plan.md), roadmap step 6
- [`../finance-rules.md`](../finance-rules.md)
- [`04-one-time-transactions.md`](04-one-time-transactions.md)
- [`05-design-system-ios.md`](05-design-system-ios.md)
- `legacy/finance-app/src/lib/designTokens.ts`
- `legacy/finance-app/src/lib/transactionTypeVisuals.ts`
- `legacy/finance-app/src/components/transactions/TransactionForm.tsx`
- [PostgREST 14 error reference](https://docs.postgrest.org/en/v14/references/errors.html)
- [PostgREST PR #4222](https://github.com/PostgREST/postgrest/pull/4222)
