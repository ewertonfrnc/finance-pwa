import { supabase } from '../../lib/supabase/client'

import type { DailySpendingSetting } from './daily-spending-types'

export type ReadDailySpendingSettingInput = {
  signal: AbortSignal
}

export async function readDailySpendingSetting({
  signal,
}: ReadDailySpendingSettingInput): Promise<DailySpendingSetting | null> {
  const { data, error } = await supabase
    .from('daily_spending_settings')
    .select('*')
    .abortSignal(signal)
    .maybeSingle()

  if (error) throw error

  return data
}

export type SetDailySpendingInput = {
  daysPerMonth: number
  expectedUpdatedAt: string | null
  monthlyAmountCents: number
}

export async function setDailySpending(
  input: SetDailySpendingInput,
): Promise<DailySpendingSetting> {
  const { data, error } = await supabase.rpc('set_daily_spending', {
    p_days_per_month: input.daysPerMonth,
    // The type generator models every RPC argument as non-nullable, so this
    // cast is the only way to send the null the function requires. An explicit
    // null means "no existing row to compare against" and selects the create
    // and idempotent-retry paths; verified against the local Data API.
    p_expected_updated_at: input.expectedUpdatedAt as string,
    p_monthly_amount_cents: input.monthlyAmountCents,
  })

  if (error) throw error

  return data
}
