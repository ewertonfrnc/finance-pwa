import { supabase } from '../../lib/supabase/client'
import { getMonthBounds } from './transaction-calendar'
import type {
  Transaction,
  TransactionKind,
  TransactionMonth,
} from './transaction-types'

const monthlyPageSize = 200

type ReadMonthlyTransactionsInput = {
  month: TransactionMonth
  signal: AbortSignal
}

export async function readMonthlyTransactions({
  month,
  signal,
}: ReadMonthlyTransactionsInput) {
  const { monthEnd, monthStart, nextMonthStart } = getMonthBounds(month)
  const transactions: Transaction[] = []

  // Offset pagination with range() is intentional for the first beta.
  // docs/plans/04-one-time-transactions.md specifies ordered, paginated
  // monthly reads of 200 rows until a short page, with `id` as deterministic
  // tie-breaker. A concurrent insert/delete between page fetches can duplicate
  // or skip a row, but the window is a single sequential fetch and >200 rows
  // in one month is rare in beta; a stable keyset or server snapshot would
  // add contract complexity before the ledger (roadmap step 8) needs it.

  for (let from = 0; ; from += monthlyPageSize) {
    let query = supabase
      .from('transactions')
      .select('*')
      .gte('transaction_date', monthStart)

    query = nextMonthStart
      ? query.lt('transaction_date', nextMonthStart)
      : query.lte('transaction_date', monthEnd!)

    const { data, error } = await query
      .order('transaction_date', { ascending: false })
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + monthlyPageSize - 1)
      .abortSignal(signal)

    if (error) throw error

    transactions.push(...data)

    if (data.length < monthlyPageSize) return transactions
  }
}

export type CreateTransactionInput = {
  amountCents: number
  description: string | null
  id: string
  kind: TransactionKind
  transactionDate: string
}

export async function createTransaction(
  input: CreateTransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase.rpc('create_transaction', {
    p_amount_cents: input.amountCents,
    // The RPC normalizes with nullif(btrim(...), ''), so an empty string is
    // equivalent to no description.
    p_description: input.description ?? '',
    p_id: input.id,
    p_kind: input.kind,
    p_transaction_date: input.transactionDate,
  })

  if (error) throw error

  return data
}

type ReadTransactionInput = {
  id: string
  signal: AbortSignal
}

export async function readTransaction({
  id,
  signal,
}: ReadTransactionInput): Promise<Transaction | null> {
  // RLS decides visibility, so a row owned by someone else arrives as null and
  // reaches the same not-found state as a row that never existed.
  const { data, error } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', id)
    .abortSignal(signal)
    .maybeSingle()

  if (error) throw error

  return data
}

export type UpdateTransactionInput = {
  amountCents: number
  description: string | null
  expectedUpdatedAt: string
  id: string
  kind: TransactionKind
  transactionDate: string
}

export async function updateTransaction(
  input: UpdateTransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase.rpc('update_transaction', {
    p_amount_cents: input.amountCents,
    p_description: input.description ?? '',
    p_expected_updated_at: input.expectedUpdatedAt,
    p_id: input.id,
    p_kind: input.kind,
    p_transaction_date: input.transactionDate,
  })

  if (error) throw error

  return data
}

export type DeleteTransactionInput = {
  expectedUpdatedAt: string
  id: string
}

export async function deleteTransaction(
  input: DeleteTransactionInput,
): Promise<Transaction> {
  const { data, error } = await supabase.rpc('delete_transaction', {
    p_expected_updated_at: input.expectedUpdatedAt,
    p_id: input.id,
  })

  if (error) throw error

  return data
}
