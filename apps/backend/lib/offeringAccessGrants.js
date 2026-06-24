/**
 * Re-export offering access helpers from @hylo/shared.
 * Use the package entry (require → dist/cjs); do not import shared `src/` here — Node loads this as CJS.
 */
export {
  validateOfferingDurationForAccessGrants,
  accessGrantsGrantOnlyTracks,
  isRecurringOfferingDuration,
  RECURRING_OFFERING_DURATIONS
} from '@hylo/shared'
