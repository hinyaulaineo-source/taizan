/**
 * In-memory sliding-window rate limiter.
 *
 * Each limiter instance tracks request counts per key (IP, userId, etc.)
 * inside a Map that is periodically pruned. On serverless platforms each
 * cold-start resets the counters, so this provides "best-effort" protection.
 * For production-grade limiting, swap this for Upstash @upstash/ratelimit
 * backed by Redis — the same `rateLimit()` call signature works.
 */

import { NextResponse } from 'next/server'

interface SlidingWindow {
  timestamps: number[]
}

interface RateLimiterOptions {
  /** Maximum requests allowed inside `windowMs`. */
  max: number
  /** Window size in milliseconds. */
  windowMs: number
}

const DEFAULT_OPTIONS: RateLimiterOptions = { max: 60, windowMs: 60_000 }

class RateLimiter {
  private windows = new Map<string, SlidingWindow>()
  private readonly max: number
  private readonly windowMs: number

  constructor(opts: RateLimiterOptions = DEFAULT_OPTIONS) {
    this.max = opts.max
    this.windowMs = opts.windowMs
  }

  check(key: string): { allowed: boolean; remaining: number; resetMs: number } {
    const now = Date.now()
    const cutoff = now - this.windowMs

    let win = this.windows.get(key)
    if (!win) {
      win = { timestamps: [] }
      this.windows.set(key, win)
    }

    win.timestamps = win.timestamps.filter((t) => t > cutoff)
    const remaining = Math.max(0, this.max - win.timestamps.length)

    if (win.timestamps.length >= this.max) {
      const oldest = win.timestamps[0] ?? now
      return { allowed: false, remaining: 0, resetMs: oldest + this.windowMs - now }
    }

    win.timestamps.push(now)
    return { allowed: true, remaining: remaining - 1, resetMs: this.windowMs }
  }

  /** Remove stale entries (call periodically or on a timer). */
  prune() {
    const cutoff = Date.now() - this.windowMs
    for (const [key, win] of this.windows) {
      win.timestamps = win.timestamps.filter((t) => t > cutoff)
      if (win.timestamps.length === 0) this.windows.delete(key)
    }
  }
}

// Prune stale entries every 5 minutes to prevent unbounded memory growth.
const PRUNE_INTERVAL = 5 * 60_000

// Shared limiter instances by tier
const limiters = new Map<string, RateLimiter>()
const pruneTimers = new Map<string, ReturnType<typeof setInterval>>()

function getLimiter(tier: string, opts: RateLimiterOptions): RateLimiter {
  let limiter = limiters.get(tier)
  if (!limiter) {
    limiter = new RateLimiter(opts)
    limiters.set(tier, limiter)
    pruneTimers.set(
      tier,
      setInterval(() => limiter!.prune(), PRUNE_INTERVAL),
    )
  }
  return limiter
}

// ────────────────────────────────────────────────
// Pre-configured tiers (adjust defaults as needed)
// ────────────────────────────────────────────────

/** Strict limit for unauthenticated / auth endpoints (signup, login). */
export const authLimiter = () => getLimiter('auth', { max: 10, windowMs: 60_000 })

/** Standard limit for authenticated API endpoints. */
export const apiLimiter = () => getLimiter('api', { max: 60, windowMs: 60_000 })

/** Tighter limit for admin/write-heavy endpoints. */
export const adminLimiter = () => getLimiter('admin', { max: 30, windowMs: 60_000 })

// ────────────────────────────────────────────────
// Helper to extract a rate-limit key from a request
// ────────────────────────────────────────────────

export function rateLimitKey(request: Request, userId?: string): string {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() ?? 'unknown'
  return userId ? `user:${userId}` : `ip:${ip}`
}

/**
 * Apply rate limiting and return a 429 response if exceeded.
 * Returns `null` when the request is within limits (continue processing).
 */
export function rateLimit(
  request: Request,
  limiter: RateLimiter,
  userId?: string,
): NextResponse | null {
  const key = rateLimitKey(request, userId)
  const result = limiter.check(key)

  if (!result.allowed) {
    return NextResponse.json(
      { error: 'Too many requests. Please try again later.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil(result.resetMs / 1000)),
          'X-RateLimit-Limit': String(limiter['max'] ?? 0),
          'X-RateLimit-Remaining': '0',
        },
      },
    )
  }

  return null
}
