export function normalizeRole(role: string | null | undefined): string | null {
  if (!role) return null
  const normalized = role.trim().toLowerCase()
  if (normalized === 'admin') return 'owner'
  return normalized
}

export function isOwnerLike(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'owner'
}

export function isAthleteRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'athlete'
}

export function isParentRole(role: string | null | undefined): boolean {
  return normalizeRole(role) === 'parent'
}

/** Owner can open athlete routes to preview the UI (booking stays disabled). */
export function canAccessAthleteDashboard(role: string | null | undefined): boolean {
  return isAthleteRole(role) || isOwnerLike(role)
}

/** Owner can open parent routes to preview the UI. */
export function canAccessParentDashboard(role: string | null | undefined): boolean {
  return isParentRole(role) || isOwnerLike(role)
}
