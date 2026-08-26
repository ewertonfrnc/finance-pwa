import type { Tables } from '../../lib/supabase/database.types'

export type Transaction = Tables<'transactions'>
export type TransactionKind = Transaction['kind']
export type TransactionMonth = string

export const TRANSACTION_DESCRIPTION_MAX_LENGTH = 120

export type TransactionDateGroup = {
  date: string
  transactions: Transaction[]
}
