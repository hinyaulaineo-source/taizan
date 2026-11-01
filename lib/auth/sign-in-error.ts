const NETWORK_ERROR_PATTERNS = [
  'load failed',
  'failed to fetch',
  'networkerror',
  'network request failed',
  'fetch failed',
]

export function formatSignInError(message: string | undefined): string {
  if (!message) return 'Sign-in failed.'

  const normalized = message.toLowerCase()
  if (NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))) {
    return 'Cannot reach the authentication service. The database may be paused or misconfigured — try again in a few minutes or contact support.'
  }

  return message
}

export function isNetworkSignInError(message: string | undefined): boolean {
  if (!message) return false
  const normalized = message.toLowerCase()
  return NETWORK_ERROR_PATTERNS.some((pattern) => normalized.includes(pattern))
}
