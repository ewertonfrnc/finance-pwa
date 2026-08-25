# Finance rules

Last reviewed: 2026-08-25

## Money

The database and Data API use integer centavos. The browser sends `12550` for
R$ 125.50 and never sends a decimal monetary value.

Transaction amounts are positive magnitudes from 1 through
9,007,199,254,740,991 centavos. `kind` determines whether a transaction adds or
subtracts money. Starting positions use a signed amount in the same safe
integer range, so a user can begin with a positive, zero, or negative balance.

Currency symbols, decimal separators, and localized formatting belong only in
the presentation layer.

## Calendar dates

Financial dates cross the Data API as `YYYY-MM-DD` strings and use PostgreSQL
`date`. The supported wire range is `0001-01-01` through `9999-12-31`. The app
must not convert these values through a timezone.

`starting_positions.effective_on` means the balance at the opening of that
calendar date. Transactions on that date apply after the opening position.

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
request with different values fails with `23505` and
`starting_position_already_exists`.

The starting position is not income. Monthly income totals must include only
`transactions` rows whose `kind` is `income`.

## One-time transactions

The initial schema supports only one-time income and expense rows:

| Field              | Wire type             | Nullable | Meaning                                   |
| ------------------ | --------------------- | -------- | ----------------------------------------- |
| `id`               | UUID string           | No       | Client-generated mutation identifier      |
| `user_id`          | UUID string           | No       | Authenticated owner                       |
| `kind`             | `income` or `expense` | No       | Direction of the movement                 |
| `amount_cents`     | positive integer      | No       | Magnitude in centavos                     |
| `description`      | string                | Yes      | Trimmed user note, at most 120 characters |
| `transaction_date` | `YYYY-MM-DD` string   | No       | Calendar date of the movement             |
| `created_at`       | timestamp string      | No       | Server creation time                      |
| `updated_at`       | timestamp string      | No       | Server update time                        |

Recurrence, tags, category budgets, and monthly balance caches are not part of
this schema.

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
own starting position, but cannot update or delete it. Direct transaction
inserts, updates, and deletes remain closed; authenticated transaction writes
use only the mutation RPCs above.

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
| `23505` | `starting_position_already_exists` | Different starting position already exists        |
| `23505` | `transaction_id_conflict`          | Transaction ID already represents other data      |
| `23514` | Named check constraint             | Invalid persisted transaction value               |
| `40001` | `transaction_conflict`             | Transaction changed after the client read it      |
| `42501` | `authentication_required`          | RPC has no authenticated identity                 |
| `42501` | PostgreSQL permission or RLS error | Authentication or authorization denied            |
| `P0002` | `transaction_not_found`            | Transaction is missing or belongs to another user |

The UI may translate these codes into useful copy. It must not display raw SQL,
policy names, tokens, or financial payloads in logs.
