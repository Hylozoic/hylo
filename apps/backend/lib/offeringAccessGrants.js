/**
 * Re-export offering access helpers from @hylo/shared source.
 * Backend resolves @hylo/shared via CJS dist, which can be stale during dev;
 * importing from source keeps validation in sync with the web app.
 */
export {
  validateOfferingDurationForAccessGrants,
  accessGrantsGrantOnlyTracks,
  isRecurringOfferingDuration,
  RECURRING_OFFERING_DURATIONS
} from '../../../packages/shared/src/OfferingHelpers.js'
