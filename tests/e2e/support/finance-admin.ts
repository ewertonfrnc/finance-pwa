import type { TablesInsert } from '../../../src/lib/supabase/database.types'
import {
  createLocalAuthAdminClient,
  type LocalAuthAdminOptions,
} from './auth-admin'

export type LocalStartingPositionFixture =
  TablesInsert<'starting_positions'> & {
    user_id: string
  }

export async function createLocalStartingPositionFixture(
  input: LocalStartingPositionFixture,
  options?: LocalAuthAdminOptions,
) {
  const client = createLocalAuthAdminClient(options)
  const { data, error } = await client
    .from('starting_positions')
    .insert({
      balance_cents: input.balance_cents,
      effective_on: input.effective_on,
      user_id: input.user_id,
    })
    .select()
    .single()

  if (error) throw error

  return data
}

export type LocalTransactionFixture = TablesInsert<'transactions'> & {
  id: string
  user_id: string
}

export async function createLocalTransactionFixtures(
  transactions: LocalTransactionFixture[],
  options?: LocalAuthAdminOptions,
) {
  const client = createLocalAuthAdminClient(options)
  const { data, error } = await client
    .from('transactions')
    .insert(transactions)
    .select()

  if (error) throw error

  return data
}

export type LocalTransactionUpdate = {
  amount_cents?: number
  description?: string | null
  transaction_date?: string
  updated_at?: string
}

// Simulates the concurrent change that another device would have committed
// while the edit form was open, without going through the version-checked RPC.
export async function updateLocalTransactionFixture(
  id: string,
  update: LocalTransactionUpdate,
  options?: LocalAuthAdminOptions,
) {
  const client = createLocalAuthAdminClient(options)
  const { data, error } = await client
    .from('transactions')
    .update(update)
    .eq('id', id)
    .select()
    .single()

  if (error) throw error

  return data
}
