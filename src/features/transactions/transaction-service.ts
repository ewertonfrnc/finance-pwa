import { supabase } from '../../lib/supabase/client'
import { getMonthBounds } from './transaction-calendar'
import type { Transaction, TransactionMonth } from './transaction-types'

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
