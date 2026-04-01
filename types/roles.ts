export type UserRole = 'owner' | 'coach' | 'athlete' | 'parent'
export type SubscriptionTier = 'standard' | 'performance' | 'elite' | 'youth_standard' | 'youth_elite'
export type SessionStatus = 'draft' | 'pending' | 'published' | 'cancelled'
export type SessionType = 'track_session' | 'gym_session' | 'recovery' | 'strength'

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  standard: 1,
  performance: 2,
  elite: 3,
  youth_standard: 4,
  youth_elite: 5,
}

export const ROLE_PERMISSIONS = {
  owner:   { canApprove: true,  canCreateSession: true,  canViewAllAthletes: true },
  coach:   { canApprove: false, canCreateSession: true,  canViewAllAthletes: true },
  athlete: { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
  parent:  { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
}
