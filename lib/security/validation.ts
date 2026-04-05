/**
 * Zod schemas for every API route payload.
 *
 * Each schema uses `.strict()` where appropriate so unexpected fields are
 * rejected (mass-assignment prevention). Lengths/ranges follow sensible
 * defaults aligned with the DB column sizes.
 */

import { COACH_TIERS } from '@/lib/coach-tier'
import { z } from 'zod'

// ────────────────────────────────────────────────
// Reusable primitives
// ────────────────────────────────────────────────

const uuid = z.string().uuid()
const safeString = (max = 500) => z.string().max(max).trim()
const email = z.string().email().max(320).trim().toLowerCase()

const VALID_ROLES = ['athlete', 'parent', 'coach'] as const
export const SUBSCRIPTION_TIERS = [
  'standard',
  'performance_100m',
  'performance_400m',
  'elite',
  'youth_standard',
  'youth_elite',
] as const
const SUBSCRIPTION_STATUSES = ['active', 'inactive'] as const
const SESSION_STATUSES_PATCH = ['draft', 'published', 'cancelled'] as const
const SESSION_TYPES = ['track_session', 'gym_session', 'recovery', 'strength'] as const
const COACH_ACTIONS = ['approve', 'reject'] as const

export const COACH_TIERS_DB = ['senior_coach', 'coach_assistant', 'junior_coach'] as const

// ────────────────────────────────────────────────
// Auth
// ────────────────────────────────────────────────

export const signupSchema = z.object({
  email,
  password: z.string().min(6).max(128),
  fullName: safeString(200).optional().nullable(),
  role: z.enum(VALID_ROLES).default('athlete'),
}).strict()

// ────────────────────────────────────────────────
// Profile
// ────────────────────────────────────────────────

export const profilePatchSchema = z.object({
  full_name: safeString(200).optional().nullable(),
  avatar_url: z.string().url().max(2048).optional().nullable(),
  main_events: z.array(safeString(50)).max(12).optional().nullable(),
}).strict()

/** Owner assigns primary coach to an athlete (coach or owner account); `coachId: null` clears assignment. */
export const adminAthleteCoachSchema = z.object({
  athleteId: uuid,
  coachId: uuid.nullable(),
}).strict()

// ────────────────────────────────────────────────
// Personal bests
// ────────────────────────────────────────────────

export const personalBestSchema = z.object({
  metric: safeString(100).min(1),
  value: z.number().positive().max(99999),
  unit: safeString(10).optional(),
  recordedAt: z.string().datetime({ offset: true }).or(z.string().date()).optional(),
}).strict()

// ────────────────────────────────────────────────
// Sessions
// ────────────────────────────────────────────────

export const sessionCreateSchema = z.object({
  title: safeString(200).min(1),
  description: safeString(2000).default(''),
  session_type: z.enum(SESSION_TYPES).default('track_session'),
  scheduled_at: z.string().min(1),
  location: safeString(500).default(''),
  allowed_tiers: z.array(z.enum(SUBSCRIPTION_TIERS)).default([...SUBSCRIPTION_TIERS]),
  max_athletes: z.number().int().min(1).max(1000).optional().nullable(),
}).strict()

export const sessionPatchSchema = z.object({
  id: uuid,
  status: z.enum(SESSION_STATUSES_PATCH),
}).strict()

export const sessionRecurringSchema = z.object({
  title: safeString(200).min(1),
  description: safeString(2000).default(''),
  session_type: z.enum(SESSION_TYPES).default('track_session'),
  start_at: z.string().min(1),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  location: safeString(500).default(''),
  allowed_tiers: z.array(z.enum(SUBSCRIPTION_TIERS)).default([...SUBSCRIPTION_TIERS]),
  weekdays: z.array(z.number().int().min(0).max(6)).max(7).optional(),
  program: safeString(5000).default(''),
  max_athletes: z.number().int().min(1).max(1000).optional().nullable(),
}).strict()

// ────────────────────────────────────────────────
// Bookings
// ────────────────────────────────────────────────

export const bookingSchema = z.object({
  sessionId: uuid,
}).strict()

export const bulkBookingSchema = z.object({
  sessionIds: z.array(uuid).min(1).max(50),
}).strict()

export const cancelBookingSchema = z.object({
  sessionId: uuid,
}).strict()

export const coachBookingSchema = z.object({
  sessionId: uuid.optional(),
  sessionIds: z.array(uuid).min(1).max(200).optional(),
  athleteIds: z.array(uuid).min(1).max(200).optional(),
  bookAllEligible: z.boolean().optional(),
  allowedTiers: z.array(z.enum(SUBSCRIPTION_TIERS)).optional(),
}).strict().refine(
  (d) => d.sessionId || (d.sessionIds && d.sessionIds.length > 0),
  { message: 'Provide sessionId or sessionIds' },
).refine(
  (d) => d.bookAllEligible || (d.athleteIds && d.athleteIds.length > 0),
  { message: 'Provide athleteIds or set bookAllEligible to true' },
)

export const coachUnbookSchema = z.object({
  sessionId: uuid.optional(),
  sessionIds: z.array(uuid).min(1).max(200).optional(),
  athleteIds: z.array(uuid).min(1).max(200),
}).strict().refine(
  (d) => d.sessionId || (d.sessionIds && d.sessionIds.length > 0),
  { message: 'Provide sessionId or sessionIds' },
)

// ────────────────────────────────────────────────
// Parent bookings
// ────────────────────────────────────────────────

export const parentBookingSchema = z.object({
  athleteId: uuid,
  sessionId: uuid,
}).strict()

export const parentCancelSchema = z.object({
  athleteId: uuid,
  sessionId: uuid,
}).strict()

// ────────────────────────────────────────────────
// Feedback
// ────────────────────────────────────────────────

export const feedbackSchema = z.object({
  athleteId: uuid,
  sessionId: uuid.optional().nullable(),
  content: safeString(5000).min(1),
}).strict()

// ────────────────────────────────────────────────
// Attendance
// ────────────────────────────────────────────────

export const attendanceBatchSchema = z.object({
  sessionId: uuid,
  records: z.array(z.object({
    athleteId: uuid,
    checkedIn: z.boolean(),
  })).min(1).max(200),
}).strict()

export const attendanceSelfSchema = z.object({
  sessionId: uuid,
  checkedIn: z.boolean(),
}).strict()

// ────────────────────────────────────────────────
// Admin
// ────────────────────────────────────────────────

export const accountDeleteSchema = z.object({
  profileId: uuid,
}).strict()

export const accountIdentitySchema = z.object({
  profileId: uuid,
  role: z.enum(VALID_ROLES),
}).strict()

export const coachRequestSchema = z.object({
  profileId: uuid,
  action: z.enum(COACH_ACTIONS),
}).strict()

export const adminCoachTierSchema = z.object({
  profileId: uuid,
  coachTier: z.enum(COACH_TIERS),
}).strict()

export const subscriptionSchema = z.object({
  athleteId: uuid,
  tier: z.enum(SUBSCRIPTION_TIERS),
  status: z.enum(SUBSCRIPTION_STATUSES),
}).strict()

export const parentLinkSchema = z.object({
  parentId: uuid,
  athleteId: uuid,
}).strict()

export const stripeCheckoutSchema = z.object({
  tier: z.enum(SUBSCRIPTION_TIERS),
  /** Stripe Price ID; must appear in STRIPE_PRICE_ALLOWLIST (comma-separated env). */
  priceId: z.string().min(1).max(128),
}).strict()

// ────────────────────────────────────────────────
// Generic parse helper
// ────────────────────────────────────────────────

export type ParseResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export function parseBody<T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> {
  const result = schema.safeParse(raw)
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    return { success: false, error: `Validation failed: ${issues}` }
  }
  return { success: true, data: result.data }
}
