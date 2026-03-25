/* eslint-env mocha */
const { expect } = require('chai')
const {
  productGrantsGroupAccess,
  isRecurringSubscriptionOffering,
  isLifetimeOrOneTimeOffering
} = require('../../../lib/membershipOfferingEligibility')

function mockProduct (attrs) {
  return {
    get: (k) => attrs[k]
  }
}

describe('membershipOfferingEligibility', () => {
  describe('productGrantsGroupAccess', () => {
    it('returns true when groupIds includes group', () => {
      const p = mockProduct({
        group_id: 1,
        access_grants: { groupIds: [5, 10] }
      })
      expect(productGrantsGroupAccess(p, 10)).to.equal(true)
    })
    it('defaults to owner group when no groupIds', () => {
      const p = mockProduct({
        group_id: 7,
        access_grants: {}
      })
      expect(productGrantsGroupAccess(p, 7)).to.equal(true)
      expect(productGrantsGroupAccess(p, 8)).to.equal(false)
    })
  })

  describe('isRecurringSubscriptionOffering', () => {
    it('accepts month/season/annual when automatic', () => {
      const p = mockProduct({ renewal_policy: 'automatic', duration: 'month' })
      expect(isRecurringSubscriptionOffering(p)).to.equal(true)
    })
    it('excludes day by default', () => {
      const p = mockProduct({ renewal_policy: 'automatic', duration: 'day' })
      expect(isRecurringSubscriptionOffering(p)).to.equal(false)
    })
    it('includes day when flag set', () => {
      const p = mockProduct({ renewal_policy: 'automatic', duration: 'day' })
      expect(isRecurringSubscriptionOffering(p, { includeDayDuration: true })).to.equal(true)
    })
  })

  describe('isLifetimeOrOneTimeOffering', () => {
    it('true for manual renewal', () => {
      const p = mockProduct({ renewal_policy: 'manual', duration: null })
      expect(isLifetimeOrOneTimeOffering(p)).to.equal(true)
    })
  })
})
