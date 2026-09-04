import {
  isRecurringOfferingDuration,
  validateOfferingDurationForAccessGrants
} from './OfferingHelpers'

describe('OfferingHelpers', () => {
  describe('isRecurringOfferingDuration', () => {
    it('returns true for recurring intervals', () => {
      expect(isRecurringOfferingDuration('month')).toBe(true)
      expect(isRecurringOfferingDuration('season')).toBe(true)
      expect(isRecurringOfferingDuration('annual')).toBe(true)
      expect(isRecurringOfferingDuration('day')).toBe(true)
    })

    it('returns false for one-time / empty', () => {
      expect(isRecurringOfferingDuration('')).toBe(false)
      expect(isRecurringOfferingDuration(null)).toBe(false)
      expect(isRecurringOfferingDuration('lifetime')).toBe(false)
    })
  })

  describe('validateOfferingDurationForAccessGrants', () => {
    it('allows recurring billing for space/group offerings', () => {
      expect(validateOfferingDurationForAccessGrants({ groupIds: [2] }, 'month')).toBeNull()
      expect(validateOfferingDurationForAccessGrants({ groupIds: [2], groupRoleIds: [3] }, 'annual')).toBeNull()
    })

    it('allows one-time purchases', () => {
      expect(validateOfferingDurationForAccessGrants({ groupIds: [1] }, '')).toBeNull()
      expect(validateOfferingDurationForAccessGrants({ groupIds: [1] }, null)).toBeNull()
    })
  })
})
