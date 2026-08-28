import { supabase } from '../../lib/supabase/client'

import type { StartingPosition } from './starting-position-types'

export type ReadStartingPositionInput = {
  signal: AbortSignal
}

export async function readStartingPosition({
  signal,
}: ReadStartingPositionInput): Promise<StartingPosition | null> {
  const { data, error } = await supabase
    .from('starting_positions')
    .select('*')
    .abortSignal(signal)
    .maybeSingle()

  if (error) throw error

  return data
}

export type InitializeStartingPositionInput = {
  balanceCents: number
  effectiveOn: string
}

export async function initializeStartingPosition(
  input: InitializeStartingPositionInput,
): Promise<StartingPosition> {
  const { data, error } = await supabase.rpc('initialize_starting_position', {
    p_balance_cents: input.balanceCents,
    p_effective_on: input.effectiveOn,
  })

  if (error) throw error

  return data
}
