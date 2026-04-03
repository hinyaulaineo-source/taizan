export type UserRole = 'owner' | 'coach' | 'athlete' | 'parent'
export type SubscriptionTier = 'standard' | 'performance_100m' | 'performance_400m' | 'elite' | 'youth_standard' | 'youth_elite'
export type SessionStatus = 'draft' | 'pending' | 'published' | 'cancelled'
export type SessionType = 'track_session' | 'gym_session' | 'recovery' | 'strength'

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  standard: 1,
  performance_100m: 2,
  performance_400m: 3,
  elite: 4,
  youth_standard: 5,
  youth_elite: 6,
}

export const ROLE_PERMISSIONS = {
  owner:   { canApprove: true,  canCreateSession: true,  canViewAllAthletes: true },
  coach:   { canApprove: false, canCreateSession: true,  canViewAllAthletes: true },
  athlete: { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
  parent:  { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
}
