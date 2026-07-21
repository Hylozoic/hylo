/* eslint-env mocha */
const { expect } = require('chai')
const {
  resolvePeriodPriceCentsForCredit,
  computeUnusedPrepaidCreditCents,
  computeHyloUnusedPrepaidCreditCents
} = require('../../../lib/membershipChangeCredit')

function productStub (priceInCents) {
  return { get: (k) => (k === 'price_in_cents' ? priceInCents : null) }
}

describe('membershipChangeCredit', () => {
  describe('resolvePeriodPriceCentsForCredit', () => {
    it('uses unit_amount × quantity from subscription item', () => {
      const sub = {
        items: {
          data: [{
            quantity: 2,
            price: { unit_amount: 1500 }
          }]
        }
      }
      expect(resolvePeriodPriceCentsForCredit(sub, productStub(999))).to.equal(3000)
    })

    it('falls back to product price when unit_amount missing', () => {
      const sub = { items: { data: [{ quantity: 1, price: { id: 'price_x' } }] } }
      expect(resolvePeriodPriceCentsForCredit(sub, productStub(2000))).to.equal(2000)
    })

    it('uses legacy plan.amount when price has no unit_amount', () => {
      const sub = {
        items: {
          data: [{
            quantity: 1,
            price: { id: 'price_x' },
            plan: { amount: 3000 }
          }]
        }
      }
      expect(resolvePeriodPriceCentsForCredit(sub, productStub(1))).to.equal(3000)
    })
  })

  describe('computeUnusedPrepaidCreditCents', () => {
    const start = 1000
    const end = 2000

    it('returns 0 when no time left', () => {
      expect(computeUnusedPrepaidCreditCents({
        periodStartSec: start,
        periodEndSec: end,
        nowSec: end,
        periodPriceCents: 10000
      })).to.equal(0)
    })

    it('returns full price when full period remains', () => {
      expect(computeUnusedPrepaidCreditCents({
        periodStartSec: start,
        periodEndSec: end,
        nowSec: start,
        periodPriceCents: 2000
      })).to.equal(2000)
    })

    it('returns ~¼ when ¼ of period remains', () => {
      expect(computeUnusedPrepaidCreditCents({
        periodStartSec: start,
        periodEndSec: start + 400,
        nowSec: start + 300,
        periodPriceCents: 2000
      })).to.equal(500)
    })
  })

  describe('computeHyloUnusedPrepaidCreditCents', () => {
    it('combines subscription period and line price', () => {
      const sub = {
        current_period_start: 0,
        current_period_end: 100,
        items: { data: [{ quantity: 1, price: { unit_amount: 2000 } }] }
      }
      expect(computeHyloUnusedPrepaidCreditCents(sub, productStub(2000), 75)).to.equal(500)
    })
  })
})
