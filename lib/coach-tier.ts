export const COACH_TIERS = ['senior_coach', 'coach_assistant', 'junior_coach'] as const

export type CoachTier = (typeof COACH_TIERS)[number]

export const COACH_TIER_LABELS: Record<CoachTier, string> = {
  senior_coach: 'Senior coach',
  coach_assistant: 'Coach assistant',
  junior_coach: 'Junior coach',
}

export const DEFAULT_COACH_TIER: CoachTier = 'coach_assistant'

export function coachTierLabel(tier: string | null | undefined): string {
  if (!tier || !COACH_TIERS.includes(tier as CoachTier)) return '—'
  return COACH_TIER_LABELS[tier as CoachTier]
}
