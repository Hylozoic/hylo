/* eslint-env mocha */
const { expect } = require('chai')
const {
  extractOfferingPresentationFields,
  mergeAccessGrantsForPresentation,
  getBuyButtonTextFromOffering,
  getSlidingScaleFromOffering,
  accessGrantsGrantTracksOnly,
  effectiveOfferingDuration
} = require('../../../lib/stripeOfferingMetadata')

function mockProduct (attrs) {
  return { get: (k) => attrs[k] }
}

describe('stripeOfferingMetadata', () => {
  describe('extractOfferingPresentationFields', () => {
    it('splits buyButtonText and slidingScale into metadata', () => {
      const { cleanAccessGrants, offeringMetadata } = extractOfferingPresentationFields({
        groupIds: [1],
        buyButtonText: '  Join  ',
        slidingScale: { enabled: true, minimum: 2 }
      })
      expect(cleanAccessGrants).to.deep.equal({ groupIds: [1] })
      expect(offeringMetadata.buyButtonText).to.equal('Join')
      expect(offeringMetadata.slidingScale).to.deep.equal({ enabled: true, minimum: 2 })
    })
    it('drops empty buy button', () => {
      const { offeringMetadata } = extractOfferingPresentationFields({
        groupIds: [1],
        buyButtonText: '   '
      })
      expect(Object.prototype.hasOwnProperty.call(offeringMetadata, 'buyButtonText')).to.equal(false)
    })
  })

  describe('mergeAccessGrantsForPresentation', () => {
    it('merges metadata into read model', () => {
      const p = mockProduct({
        access_grants: { groupIds: [1] },
        metadata: { buyButtonText: 'Go', slidingScale: { enabled: true } }
      })
      const merged = mergeAccessGrantsForPresentation(p)
      expect(merged.groupIds).to.deep.equal([1])
      expect(merged.buyButtonText).to.equal('Go')
      expect(merged.slidingScale.enabled).to.equal(true)
    })
  })

  describe('getSlidingScaleFromOffering', () => {
    it('prefers metadata over access_grants', () => {
      const p = mockProduct({
        access_grants: { slidingScale: { enabled: true, minimum: 1 } },
        metadata: { slidingScale: { enabled: true, minimum: 9 } }
      })
      expect(getSlidingScaleFromOffering(p).minimum).to.equal(9)
    })
  })

  describe('getBuyButtonTextFromOffering', () => {
    it('prefers metadata', () => {
      const p = mockProduct({
        access_grants: { buyButtonText: 'Old' },
        metadata: { buyButtonText: 'New' }
      })
      expect(getBuyButtonTextFromOffering(p)).to.equal('New')
    })
  })

  describe('accessGrantsGrantTracksOnly', () => {
    it('returns true when only trackIds are set', () => {
      expect(accessGrantsGrantTracksOnly({ trackIds: [1, 2] })).to.equal(true)
    })

    it('returns false when groups or roles are included', () => {
      expect(accessGrantsGrantTracksOnly({ trackIds: [1], groupIds: [2] })).to.equal(false)
      expect(accessGrantsGrantTracksOnly({ trackIds: [1], commonRoleIds: [3] })).to.equal(false)
      expect(accessGrantsGrantTracksOnly({ trackIds: [1], groupRoleIds: [4] })).to.equal(false)
    })
  })

  describe('effectiveOfferingDuration', () => {
    it('forces one-time for tracks-only offerings', () => {
      expect(effectiveOfferingDuration({ trackIds: [1] }, 'month')).to.equal(null)
    })

    it('preserves duration for non-track-only offerings', () => {
      expect(effectiveOfferingDuration({ groupIds: [1] }, 'month')).to.equal('month')
    })
  })
})
