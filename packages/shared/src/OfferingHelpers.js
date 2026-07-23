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
 * Validates that offering duration matches access grants.
 * Space and group offerings may use one-time or recurring billing.
 * Returns an error message string, or null if valid.
 */
export function validateOfferingDurationForAccessGrants (accessGrants, duration) {
  return null
}
