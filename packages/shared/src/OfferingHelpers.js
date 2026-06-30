/**
 * Helpers for Stripe offering configuration (duration vs access grants).
 */

export const RECURRING_OFFERING_DURATIONS = ['day', 'month', 'season', 'annual']

/**
 * Returns true when duration is a recurring billing interval (subscription).
 */
export function isRecurringOfferingDuration (duration) {
  if (!duration) return false
  return RECURRING_OFFERING_DURATIONS.includes(duration)
}

/**
 * Returns true when access grants include tracks but no group or role access.
 * Tracks are one-time purchases; recurring billing applies to memberships.
 */
export function accessGrantsGrantOnlyTracks (accessGrants) {
  if (!accessGrants) return false

  const hasTracks = Array.isArray(accessGrants.trackIds) && accessGrants.trackIds.length > 0
  const hasGroups = Array.isArray(accessGrants.groupIds) && accessGrants.groupIds.length > 0
  const hasGroupRoles = Array.isArray(accessGrants.groupRoleIds) && accessGrants.groupRoleIds.length > 0

  return hasTracks && !hasGroups && !hasGroupRoles
}

/**
 * Validates that offering duration matches access grants.
 * Returns an error message string, or null if valid.
 */
export function validateOfferingDurationForAccessGrants (accessGrants, duration) {
  if (accessGrantsGrantOnlyTracks(accessGrants) && isRecurringOfferingDuration(duration)) {
    return 'Track-only offerings must use a one-time price. Recurring billing is for memberships (group or role access).'
  }
  return null
}
