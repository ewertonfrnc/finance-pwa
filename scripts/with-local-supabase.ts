import { execFile, spawn } from 'node:child_process'
import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'

import { assertLoopbackUrl } from './loopback-url'

const execFileAsync = promisify(execFile)
const readinessTimeoutMs = 30_000

type Environment = NodeJS.ProcessEnv
type LocalSupabaseStatus = Record<string, unknown>

function requireStatusValue(
  status: LocalSupabaseStatus,
  names: string[],
  label: string,
) {
  for (const name of names) {
    const value = status[name]

    if (typeof value === 'string' && value.length > 0) return value
  }

  throw new Error(`Local Supabase status did not include ${label}.`)
}

async function readLocalSupabaseStatus() {
  let stdout: string

  try {
    const result = await execFileAsync(
      'bunx',
      ['supabase', 'status', '--output', 'json'],
      { encoding: 'utf8' },
    )
    stdout = result.stdout
  } catch {
    throw new Error(
      'Local Supabase is not running. Start it with `bunx supabase start`.',
    )
  }

  try {
    return JSON.parse(stdout) as LocalSupabaseStatus
  } catch {
    throw new Error('Local Supabase returned an unreadable status response.')
  }
}

async function waitForEndpoint(url: URL, label: string) {
  const deadline = Date.now() + readinessTimeoutMs

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, {
        signal: AbortSignal.timeout(1_000),
      })

      if (response.ok) return
    } catch {
      // The local service may still be starting.
    }

    await new Promise((resolve) => setTimeout(resolve, 250))
  }

  throw new Error(`${label} did not become ready within 30 seconds.`)
}

function withoutSupabaseVariables(environment: Environment) {
  return Object.fromEntries(
    Object.entries(environment).filter(
      ([name]) => !name.toUpperCase().includes('SUPABASE'),
    ),
  ) as Environment
}

async function assertCredentialIsAbsent(directory: string, credential: string) {
  const entries = await readdir(directory, { withFileTypes: true })

  await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name)

      if (entry.isDirectory()) {
        return assertCredentialIsAbsent(entryPath, credential)
      }

      if ((await readFile(entryPath)).includes(credential)) {
        throw new Error(
          'Vite build contained the local service role credential.',
        )
      }
    }),
  )
}

async function runCommand(
  command: string,
  args: string[],
  environment: Environment,
  label: string,
) {
  await new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      env: environment,
      stdio: 'inherit',
    })

    child.once('error', () => reject(new Error(`${label} could not start.`)))
    child.once('exit', (code, signal) => {
      if (code === 0) {
        resolve()
        return
      }

      const reason = signal ? `signal ${signal}` : `exit code ${code}`
      reject(new Error(`${label} failed with ${reason}.`))
    })
  })
}

async function main() {
  const status = await readLocalSupabaseStatus()
  const apiUrl = assertLoopbackUrl(
    requireStatusValue(status, ['API_URL'], 'the API URL'),
    'Local Supabase API URL',
  )
  const mailpitUrl = assertLoopbackUrl(
    requireStatusValue(
      status,
      ['MAILPIT_URL', 'INBUCKET_URL'],
      'the Mailpit URL',
    ),
    'Local Mailpit URL',
  )
  const publishableKey = requireStatusValue(
    status,
    ['PUBLISHABLE_KEY'],
    'the publishable key',
  )
  const serviceRoleKey = requireStatusValue(
    status,
    ['SERVICE_ROLE_KEY'],
    'the service role key',
  )

  await Promise.all([
    waitForEndpoint(new URL('/auth/v1/health', apiUrl), 'Local Auth'),
    waitForEndpoint(new URL('/api/v1/info', mailpitUrl), 'Local Mailpit'),
  ])

  const cleanEnvironment = withoutSupabaseVariables(process.env)
  const publicEnvironment = {
    ...cleanEnvironment,
    VITE_SUPABASE_PUBLISHABLE_KEY: publishableKey,
    VITE_SUPABASE_URL: apiUrl.origin,
  }

  await runCommand('bun', ['run', 'build'], publicEnvironment, 'Vite build')
  await assertCredentialIsAbsent('dist', serviceRoleKey)

  await runCommand(
    'bunx',
    ['playwright', 'test', ...process.argv.slice(2)],
    {
      ...publicEnvironment,
      LOCAL_MAILPIT_URL: mailpitUrl.origin,
      LOCAL_SUPABASE_SERVICE_ROLE_KEY: serviceRoleKey,
      LOCAL_SUPABASE_URL: apiUrl.origin,
    },
    'Playwright',
  )
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Local E2E failed.'
  console.error(message)
  process.exitCode = 1
})
