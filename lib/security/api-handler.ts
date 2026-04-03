/**
 * Thin wrapper that applies rate limiting, body size limits, and
 * JSON parsing to any API route handler. Keeps route files focused on
 * business logic rather than boilerplate security checks.
 */

import { NextResponse } from 'next/server'
import { rateLimit, apiLimiter, authLimiter, adminLimiter } from './rate-limit'

const MAX_BODY_BYTES = 512 * 1024 // 512 KB — reject oversized payloads early

type Tier = 'auth' | 'api' | 'admin'

function limiterForTier(tier: Tier) {
  switch (tier) {
    case 'auth':
      return authLimiter()
    case 'admin':
      return adminLimiter()
    default:
      return apiLimiter()
  }
}

/**
 * Parse JSON body from a Request with a size guard.
 * Returns `null` if the body is empty or unparseable.
 */
export async function safeJsonParse(request: Request): Promise<unknown | null> {
  const contentLength = request.headers.get('content-length')
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return '__TOO_LARGE__'
  }

  try {
    return await request.json()
  } catch {
    return null
  }
}

/**
 * Apply rate limiting to a request and return a 429 if exceeded,
 * or null if the request should proceed.
 */
export function applyRateLimit(
  request: Request,
  tier: Tier = 'api',
  userId?: string,
): NextResponse | null {
  return rateLimit(request, limiterForTier(tier), userId)
}
