import { assertLoopbackUrl } from '../../../scripts/loopback-url'

interface MailpitAddress {
  Address: string
  Name: string
}

interface MailpitMessageSummary {
  ID: string
  Subject: string
  To: MailpitAddress[]
}

interface MailpitSearchResponse {
  messages: MailpitMessageSummary[]
}

export interface MailpitMessage extends MailpitMessageSummary {
  HTML: string
  Text: string
}

interface FindMessageOptions {
  mailpitUrl?: string
  pollIntervalMs?: number
  timeoutMs?: number
}

function requireMailpitUrl(value: string | undefined) {
  if (!value) {
    throw new Error(
      'Missing local test environment variable: LOCAL_MAILPIT_URL',
    )
  }

  return value
}

async function fetchJson<T>(url: URL, label: string) {
  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(`${label} returned HTTP ${response.status}.`)
  }

  return (await response.json()) as T
}

export async function findMailpitMessageByRecipient(
  recipient: string,
  options: FindMessageOptions = {},
) {
  const mailpitUrl = assertLoopbackUrl(
    options.mailpitUrl ?? requireMailpitUrl(process.env.LOCAL_MAILPIT_URL),
    'Local Mailpit URL',
  )
  const timeoutMs = options.timeoutMs ?? 10_000
  const pollIntervalMs = options.pollIntervalMs ?? 100
  const deadline = Date.now() + timeoutMs
  const searchUrl = new URL('/api/v1/search', mailpitUrl)
  searchUrl.searchParams.set('query', `to:${recipient}`)

  do {
    const search = await fetchJson<MailpitSearchResponse>(
      searchUrl,
      'Local Mailpit search',
    )
    const summary = search.messages.find((message) =>
      message.To.some(
        (address) => address.Address.toLowerCase() === recipient.toLowerCase(),
      ),
    )

    if (summary) {
      return fetchJson<MailpitMessage>(
        new URL(
          `/api/v1/message/${encodeURIComponent(summary.ID)}`,
          mailpitUrl,
        ),
        'Local Mailpit message',
      )
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs))
  } while (Date.now() <= deadline)

  throw new Error(
    `No local email arrived for ${recipient} within ${timeoutMs} ms.`,
  )
}
