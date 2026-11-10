// The Axolotl bot. Kept here so the cron and the CLI can run without Sails.
export const AXOLOTL_ID = 13986

export const MIN_COHORT = 5

/** A group's rate is hidden when fewer than this many people are in the denominator. */
export function isSmallCohort (groupId, denominator) {
  return String(groupId) !== '0' && Number(denominator) > 0 && Number(denominator) < MIN_COHORT
}
