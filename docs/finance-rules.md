# Finance rules

Last reviewed: 2026-08-28

## Money

The database and Data API use integer centavos. The browser sends `12550` for
R$ 125.50 and never sends a decimal monetary value.

Transaction amounts are positive magnitudes from 1 through
9,007,199,254,740,991 centavos. `kind` determines whether a transaction adds or
subtracts money. Starting positions are signed in PostgreSQL from
`-9007199254740991` through `9007199254740991` centavos, so a negative opening
can be represented, but the shipped onboarding only sends zero or positive; the
form shows `R$ 0,00` for an empty draft and `formatSignedCents` (U+2212) for
any saved negative row rendered in the detail.

Currency symbols, decimal separators, and localized formatting belong only in
the presentation layer.

## Calendar dates

Financial dates cross the Data API as `YYYY-MM-DD` strings and use PostgreSQL
`date`. The supported wire range is `0001-01-01` through `9999-12-31`. The app
must not convert these values through a timezone.

`starting_positions.effective_on` means the balance at the opening of that
calendar date. Transactions on that date apply after the opening position. The
shipped UI fixes `effective_on` to the device-local `YYYY-MM-DD` (`getLocalTodayIsoDate`,
no `toISOString` or UTC conversion) and tells the user “Informe quanto você
tem agora somando suas contas. Esse é o saldo na abertura de hoje —
lançamentos de hoje entram depois, o foco é daqui pra frente.” and “Some o
saldo que você tem agora nas suas contas. O ponto de partida pode ser zero ou
positivo e não poderá ser alterado nesta versão.” The review shows the signed
`R$` value, the long localized date, and “Esse valor vira seu ponto de partida
e não poderá ser alterado nesta versão. Lançamentos do mesmo dia entram depois
dele.”

## Starting position

Each authenticated user has at most one row in `starting_positions`:

| Field           | Wire type           | Nullable | Meaning                             |
| --------------- | ------------------- | -------- | ----------------------------------- |
| `user_id`       | UUID string         | No       | Owner derived from the access token |
| `balance_cents` | integer             | No       | Signed opening balance in centavos  |
| `effective_on`  | `YYYY-MM-DD` string | No       | Opening date for the balance        |
| `created_at`    | timestamp string    | No       | Server creation time                |

Clients initialize the row through
`initialize_starting_position(p_balance_cents, p_effective_on)`. The function
uses `auth.uid()` and does not accept a user ID. Repeating the same request
returns the existing row, which makes an onboarding retry safe. A second
request with different values fails with `23505`
`starting_position_already_exists`. The shipped client keeps the populated
review values after every failure, disables `Confirmar ponto de partida` while
offline or pending (with `Sem conexão. O rascunho continua aqui; conecte-se
para confirmar.` or `Salvando ponto de partida…` associated via
`aria-describedby`), and on `23505` refetches the authoritative row and opens
`/app/starting-position?notice=already-saved`, which shows “Um ponto de partida
já foi salvo com outros valores. O valor exibido abaixo foi mantido. O rascunho
que você enviou não foi salvo.” The row is immutable in this release: no
`update`/`delete` RPC, no table `UPDATE`/`DELETE` grant, and RLS only allows
`select`/`insert` for the owner. The detail at `/app/starting-position` renders
the saved `R$` and `YYYY-MM-DD` + long date and “Esse é o saldo na abertura de
… Lançamentos do mesmo dia entram depois dele. Esse valor não pode ser alterado
nesta versão.” with a `44×44` back link to the same `?month=`.

The starting position is not income. Monthly income totals must include only
`transactions` rows whose `kind` is `income`.

## One-time transactions

The schema supports one-time transactions of four kinds:

| Field              | Wire type                                  | Nullable | Meaning                                   |
| ------------------ | ------------------------------------------ | -------- | ----------------------------------------- |
| `id`               | UUID string                                | No       | Client-generated mutation identifier      |
| `user_id`          | UUID string                                | No       | Authenticated owner                       |
| `kind`             | `income`, `expense`, `daily`, or `savings` | No       | Direction and category of the movement    |
| `amount_cents`     | positive integer                           | No       | Magnitude in centavos                     |
| `description`      | string                                     | Yes      | Trimmed user note, at most 120 characters |
| `transaction_date` | `YYYY-MM-DD` string                        | No       | Calendar date of the movement             |
| `created_at`       | timestamp string                           | No       | Server creation time                      |
| `updated_at`       | timestamp string                           | No       | Server update time                        |

Recurrence, tags, category budgets, and monthly balance caches are not part of
this schema.

### Kind semantics

`amount_cents` is always a positive magnitude. `kind` determines direction and
category meaning:

| Kind      | Label    | Available-balance effect | Category meaning                            |
| --------- | -------- | ------------------------ | ------------------------------------------- |
| `income`  | Entrada  | Adds the amount          | Money received                              |
| `expense` | Saída    | Subtracts the amount     | Point expense                               |
| `daily`   | Diário   | Subtracts the amount     | Routine daily spending                      |
| `savings` | Economia | Subtracts the amount     | Value reserved outside the expense category |

Only `income` adds to available balance; `expense`, `daily`, and `savings` all
subtract from it. `daily` participates in the daily projection contract
delivered in roadmap step 8; that projection is not implemented yet. `savings`
subtracts from available balance like `expense`, but it is a distinct kind and
must not be reclassified or aggregated as `expense`.

A wire value outside `income`, `expense`, `daily`, and `savings` fails while
PostgreSQL casts the RPC argument to `public.transaction_kind`. The stable
code is `22P02`; no application fallback or compatibility label accepts an
unsupported kind.

### Mutation RPCs

The browser writes transactions only through these functions:

| Function             | Parameters                                                                                                                                            | Result                       |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- |
| `create_transaction` | `p_id uuid`, `p_kind transaction_kind`, `p_amount_cents bigint`, `p_description text`, `p_transaction_date date`                                      | Persisted `transactions` row |
| `update_transaction` | `p_id uuid`, `p_expected_updated_at timestamptz`, `p_kind transaction_kind`, `p_amount_cents bigint`, `p_description text`, `p_transaction_date date` | Updated `transactions` row   |
| `delete_transaction` | `p_id uuid`, `p_expected_updated_at timestamptz`                                                                                                      | Deleted `transactions` row   |

`create_transaction` derives `user_id` from `auth.uid()`. The client generates
`p_id` once per submission and retains it while retrying the same normalized
payload. An identical retry returns the existing row. Reusing the ID with
different content, or with a row owned by another user, fails with
`transaction_id_conflict`.

Create and update normalize the description with
`nullif(btrim(p_description), '')`. This removes surrounding whitespace and
stores an empty or whitespace-only value as `null`.

Update and delete require the exact `updated_at` returned by the last read or
mutation. Each function locks the caller-owned row before comparing this
version. Update returns a strictly newer `updated_at`; a stale version fails
without changing or deleting the newer row. Missing IDs and IDs owned by
another user both return `transaction_not_found`.

## Authorization

The browser uses a publishable key. A secret key or legacy `service_role` key
must never reach a `VITE_` variable.

Anonymous users have no table or function privileges. Authenticated users can
read their own starting position and transactions. They can initialize their
own starting position (`select`, `insert` on `starting_positions`,
`execute` on `initialize_starting_position`), but cannot update or delete it;
the workspace exposes the saved row at `/app/starting-position` via a `44×44`
`Ponto de partida` link inside the account capsule, with `shrink-0` so month
buttons keep `44×44` at `375×667`. Direct transaction inserts, updates, and
deletes remain closed; authenticated transaction writes use only the mutation
RPCs above.

RLS compares `auth.uid()` with `user_id`. A missing row in an authenticated
query can mean either that the row does not exist or that it belongs to another
user. The client must not reveal which case occurred.

## Error contract

Database and Data API errors expose PostgreSQL codes:

| Code    | Stable message or source           | Meaning                                           |
| ------- | ---------------------------------- | ------------------------------------------------- |
| `22023` | `balance_cents_out_of_range`       | Invalid starting balance                          |
| `22023` | `effective_on_out_of_range`        | Invalid starting date                             |
| `22023` | `transaction_id_required`          | Missing transaction mutation ID                   |
| `22023` | `transaction_kind_required`        | Missing transaction kind                          |
| `22023` | `transaction_version_required`     | Missing update or delete concurrency version      |
| `22023` | `amount_cents_out_of_range`        | Invalid transaction amount                        |
| `22023` | `transaction_date_out_of_range`    | Invalid transaction date                          |
| `22023` | `description_too_long`             | Normalized description exceeds 120 characters     |
| `22P02` | PostgreSQL enum input error        | Unsupported transaction kind                      |
| `23505` | `starting_position_already_exists` | Different starting position already exists        |
| `23505` | `transaction_id_conflict`          | Transaction ID already represents other data      |
| `23514` | Named check constraint             | Invalid persisted transaction value               |
| `42501` | `authentication_required`          | RPC has no authenticated identity                 |
| `42501` | PostgreSQL permission or RLS error | Authentication or authorization denied            |
| `P0002` | `transaction_not_found`            | Transaction is missing or belongs to another user |
| `PT409` | `transaction_conflict`             | Transaction changed after the client read it      |

The UI may translate these codes into useful copy. It must not display raw SQL,
policy names, tokens, or financial payloads in logs. The starting-position
client maps `${code}:${message}`: `22023:balance_cents_out_of_range` →
`Informe um saldo suportado.`, `22023:effective_on_out_of_range` → `Escolha uma
data válida para o ponto de partida.`, `42501:authentication_required` →
`Sua sessão expirou. Entre novamente para continuar.`, other `42501` →
`Você não tem permissão para esta ação.`,
`23505:starting_position_already_exists` → refetch the authoritative row and
open `/app/starting-position?notice=already-saved`, unknown → `Não foi
possível salvar o ponto de partida. Tente novamente.`

### Conflict code: `PT409`

`update_transaction` and `delete_transaction` raise `PT409` (HTTP 409) instead
of `SQLSTATE 40001` when the caller's `p_expected_updated_at` no longer
matches the row. PostgreSQL treats `40001` as `serialization_failure`, and
local PostgREST 14.17 retries that transaction internally instead of
returning it, so a stale-version conflict never reached the browser and the
E2E request timed out. `PTxyz` is PostgREST's documented way for a function to
choose its own HTTP status; `PT409` returns HTTP 409 once and is not treated
as a serialization failure.

The frontend still recognizes `40001` as the same recoverable conflict. That
recognition exists only as rollout compatibility for an environment that has
received the frontend but not yet the database migration that raises `PT409`;
`PT409` is the canonical contract going forward.
