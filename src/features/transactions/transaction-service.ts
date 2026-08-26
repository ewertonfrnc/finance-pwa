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
