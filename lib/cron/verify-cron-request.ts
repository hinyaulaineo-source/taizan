/**
 * Vercel Cron sends Authorization: Bearer <CRON_SECRET> when CRON_SECRET is set in project env.
 * For manual runs, use the same header.
 */
export function assertCronAuthorized(request: Request): void {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    throw new Error('CRON_SECRET is not configured')
  }
  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${secret}`) {
    const err = new Error('Unauthorized')
    ;(err as Error & { status: number }).status = 401
    throw err
  }
}

export function isCronAuthorized(request: Request): boolean {
  try {
    assertCronAuthorized(request)
    return true
  } catch {
    return false
  }
}
