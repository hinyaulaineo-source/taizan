export type UserRole = 'owner' | 'coach' | 'athlete' | 'parent'
export type SubscriptionTier = 'starter' | 'performance' | 'elite'
export type SessionStatus = 'draft' | 'pending' | 'published' | 'cancelled'
export type SessionType = 'track_session' | 'gym_session' | 'recovery' | 'strength'

export const TIER_ORDER: Record<SubscriptionTier, number> = {
  starter: 1,
  performance: 2,
  elite: 3,
}

export const ROLE_PERMISSIONS = {
  owner:   { canApprove: true,  canCreateSession: true,  canViewAllAthletes: true },
  coach:   { canApprove: false, canCreateSession: true,  canViewAllAthletes: true },
  athlete: { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
  parent:  { canApprove: false, canCreateSession: false, canViewAllAthletes: false },
}
