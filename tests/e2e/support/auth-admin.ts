import { createClient } from '@supabase/supabase-js'

interface LocalAuthAdminOptions {
  apiUrl?: string
  serviceRoleKey?: string
}

function requireEnvironmentVariable(name: string, value: string | undefined) {
  if (!value)
    throw new Error(`Missing local test environment variable: ${name}`)

  return value
}

export function assertLoopbackUrl(value: string, label: string) {
  let url: URL

  try {
    url = new URL(value)
  } catch {
    throw new Error(`${label} is not a valid URL.`)
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, '')
  const isLoopback =
    hostname === 'localhost' ||
    hostname === '::1' ||
    /^127(?:\.\d{1,3}){3}$/.test(hostname)

  if (
    !isLoopback ||
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password
  ) {
    throw new Error(`${label} must use a loopback HTTP URL.`)
  }

  return url
}

export function createLocalAuthAdminClient(
  options: LocalAuthAdminOptions = {},
) {
  const apiUrl = assertLoopbackUrl(
    options.apiUrl ??
      requireEnvironmentVariable(
        'LOCAL_SUPABASE_URL',
        process.env.LOCAL_SUPABASE_URL,
      ),
    'Local Supabase API URL',
  )
  const serviceRoleKey =
    options.serviceRoleKey ??
    requireEnvironmentVariable(
      'LOCAL_SUPABASE_SERVICE_ROLE_KEY',
      process.env.LOCAL_SUPABASE_SERVICE_ROLE_KEY,
    )

  return createClient(apiUrl.origin, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  })
}

export async function createLocalAuthUser(
  input: { email: string; emailConfirm?: boolean; password: string },
  options?: LocalAuthAdminOptions,
) {
  const client = createLocalAuthAdminClient(options)
  const { data, error } = await client.auth.admin.createUser({
    email: input.email,
    email_confirm: input.emailConfirm ?? true,
    password: input.password,
  })

  if (error) throw error

  return data.user
}

export async function deleteLocalAuthUser(
  userId: string,
  options?: LocalAuthAdminOptions,
) {
  const client = createLocalAuthAdminClient(options)
  const { error } = await client.auth.admin.deleteUser(userId)

  if (error) throw error
}
