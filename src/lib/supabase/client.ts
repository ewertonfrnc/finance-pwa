import { createClient } from '@supabase/supabase-js'

import type { Database } from './database.types'

function requirePublicEnvironmentVariable(
  name: string,
  value: string | undefined,
) {
  if (!value) {
    throw new Error(`Missing public environment variable: ${name}`)
  }

  return value
}

const supabaseUrl = requirePublicEnvironmentVariable(
  'VITE_SUPABASE_URL',
  import.meta.env.VITE_SUPABASE_URL,
)
const supabasePublishableKey = requirePublicEnvironmentVariable(
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
)

export const supabase = createClient<Database>(
  supabaseUrl,
  supabasePublishableKey,
)
