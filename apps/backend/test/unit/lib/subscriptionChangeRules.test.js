/* eslint-env mocha */
const { expect } = require('chai')
const {
  SUBSCRIPTION_CHANGE_MODE,
  resolveSubscriptionChangeMode,
  getBillingPeriodMonths,
  sameBillingPeriod,
  getStripeBillingSpec
} = require('../../../lib/subscriptionChangeRules')

describe('subscriptionChangeRules', () => {
  describe('getBillingPeriodMonths', () => {
    it('maps recurring durations', () => {
      expect(getBillingPeriodMonths('month')).to.equal(1)
      expect(getBillingPeriodMonths('season')).to.equal(3)
      expect(getBillingPeriodMonths('annual')).to.equal(12)
    })
    it('returns null for day and lifetime', () => {
      expect(getBillingPeriodMonths('day')).to.equal(null)
      expect(getBillingPeriodMonths('lifetime')).to.equal(null)
    })
  })

  describe('sameBillingPeriod', () => {
    it('is strict string equality', () => {
      expect(sameBillingPeriod('month', 'month')).to.equal(true)
      expect(sameBillingPeriod('month', 'season')).to.equal(false)
    })
  })

  describe('getStripeBillingSpec', () => {
    it('matches Hylo duration to interval shape', () => {
      expect(getStripeBillingSpec('season')).to.deep.equal({ interval: 'month', intervalCount: 3 })
      expect(getStripeBillingSpec('annual')).to.deep.equal({ interval: 'year', intervalCount: 1 })
    })
  })

  describe('resolveSubscriptionChangeMode', () => {
    const base = {
      currentDuration: 'month',
      targetDuration: 'month',
      currentPriceCents: 1000,
      targetPriceCents: 1000,
      currentCurrency: 'usd',
      targetCurrency: 'usd'
    }

    it('past_due → no proration', () => {
      const r = resolveSubscriptionChangeMode({ ...base, isPastDue: true })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.PAST_DUE_NO_PRORATION)
    })

    it('sliding scale quantity only → next cycle', () => {
      const r = resolveSubscriptionChangeMode({ ...base, isSlidingScaleQuantityOnly: true })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.SLIDING_SCALE_NEXT_CYCLE)
    })

    it('target lifetime → lifetime path', () => {
      const r = resolveSubscriptionChangeMode({ ...base, targetIsLifetime: true })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.LIFETIME_NO_PRORATION)
    })

    it('currency mismatch → blocked', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentCurrency: 'usd',
        targetCurrency: 'eur'
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.CURRENCY_MISMATCH_BLOCKED)
    })

    it('day duration involved → scheduled (no immediate proration)', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentDuration: 'day',
        targetDuration: 'month'
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END)
      expect(r.reason).to.equal('day_duration_test_only_no_immediate_proration')
    })

    it('longer period → immediate upgrade', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentDuration: 'month',
        targetDuration: 'annual'
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.IMMEDIATE_UPGRADE)
      expect(r.reason).to.equal('longer_billing_period')
    })

    it('same period higher price → immediate upgrade', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentDuration: 'month',
        targetDuration: 'month',
        currentPriceCents: 1000,
        targetPriceCents: 2000
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.IMMEDIATE_UPGRADE)
      expect(r.reason).to.equal('same_period_higher_price')
    })

    it('same period lower price → scheduled', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentDuration: 'month',
        targetDuration: 'month',
        currentPriceCents: 2000,
        targetPriceCents: 1000
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END)
    })

    it('shorter period → scheduled', () => {
      const r = resolveSubscriptionChangeMode({
        ...base,
        currentDuration: 'annual',
        targetDuration: 'month',
        currentPriceCents: 1000,
        targetPriceCents: 5000
      })
      expect(r.mode).to.equal(SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END)
      expect(r.reason).to.equal('shorter_period_or_other')
    })
  })
})
