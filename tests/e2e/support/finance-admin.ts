import type { TablesInsert } from '../../../src/lib/supabase/database.types'
import {
  createLocalAuthAdminClient,
  type LocalAuthAdminOptions,
} from './auth-admin'

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
