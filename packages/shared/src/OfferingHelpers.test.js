import {
  accessGrantsGrantOnlyTracks,
  isRecurringOfferingDuration,
  validateOfferingDurationForAccessGrants
} from './OfferingHelpers'

describe('OfferingHelpers', () => {
  describe('isRecurringOfferingDuration', () => {
    it('returns true for recurring durations', () => {
      expect(isRecurringOfferingDuration('month')).toBe(true)
      expect(isRecurringOfferingDuration('season')).toBe(true)
      expect(isRecurringOfferingDuration('annual')).toBe(true)
      expect(isRecurringOfferingDuration('day')).toBe(true)
    })

    it('returns false for one-time durations', () => {
      expect(isRecurringOfferingDuration('')).toBe(false)
      expect(isRecurringOfferingDuration(null)).toBe(false)
      expect(isRecurringOfferingDuration('lifetime')).toBe(false)
    })
  })

  describe('accessGrantsGrantOnlyTracks', () => {
    it('returns true when only tracks are granted', () => {
      expect(accessGrantsGrantOnlyTracks({ trackIds: [1] })).toBe(true)
    })

    it('returns false when tracks are combined with groups or roles', () => {
      expect(accessGrantsGrantOnlyTracks({ trackIds: [1], groupIds: [2] })).toBe(false)
      expect(accessGrantsGrantOnlyTracks({ trackIds: [1], groupRoleIds: [3] })).toBe(false)
      expect(accessGrantsGrantOnlyTracks({ trackIds: [1], commonRoleIds: [4] })).toBe(false)
    })

    it('returns false when no tracks are granted', () => {
      expect(accessGrantsGrantOnlyTracks({ groupIds: [2] })).toBe(false)
      expect(accessGrantsGrantOnlyTracks({})).toBe(false)
      expect(accessGrantsGrantOnlyTracks(null)).toBe(false)
    })
  })

  describe('validateOfferingDurationForAccessGrants', () => {
    it('rejects recurring duration for track-only offerings', () => {
      const error = validateOfferingDurationForAccessGrants({ trackIds: [1] }, 'month')
      expect(error).toBeTruthy()
    })

    it('allows one-time duration for track-only offerings', () => {
      expect(validateOfferingDurationForAccessGrants({ trackIds: [1] }, '')).toBeNull()
      expect(validateOfferingDurationForAccessGrants({ trackIds: [1] }, null)).toBeNull()
      expect(validateOfferingDurationForAccessGrants({ trackIds: [1] }, 'lifetime')).toBeNull()
    })

    it('allows recurring duration when groups or roles are included', () => {
      expect(validateOfferingDurationForAccessGrants({ trackIds: [1], groupIds: [2] }, 'month')).toBeNull()
      expect(validateOfferingDurationForAccessGrants({ groupIds: [2] }, 'month')).toBeNull()
    })
  })
})
