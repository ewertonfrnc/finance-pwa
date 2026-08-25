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
