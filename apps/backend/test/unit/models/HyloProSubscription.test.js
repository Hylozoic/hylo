/* eslint-disable no-unused-expressions */
import setup from '../../setup'
import factories from '../../setup/factories'

/* global HyloProSubscription */

const NOW = new Date('2026-06-15T12:00:00Z')
const PAST = new Date('2026-06-01T00:00:00Z')
const FUTURE = new Date('2026-07-01T00:00:00Z')

const stripeRow = attrs => ({ source: 'stripe', status: 'active', cancel_at_period_end: false, ...attrs })
const manualRow = attrs => ({ source: 'manual', status: 'active', ...attrs })

describe('HyloProSubscription', () => {
  describe('isActive', () => {
    const isActive = row => HyloProSubscription.isActive(row, NOW)

    it('is active for an active or trialing Stripe subscription', () => {
      expect(isActive(stripeRow({ current_period_end: FUTURE }))).to.be.true
      expect(isActive(stripeRow({ status: 'trialing', current_period_end: FUTURE }))).to.be.true
    })

    it('is not active for other Stripe statuses', () => {
      for (const status of ['past_due', 'unpaid', 'canceled', 'incomplete', 'incomplete_expired', 'paused']) {
        expect(isActive(stripeRow({ status, current_period_end: FUTURE })), status).to.be.false
      }
    })

    it('stays active after cancelling until the period ends', () => {
      expect(isActive(stripeRow({ cancel_at_period_end: true, cancel_at: FUTURE, current_period_end: FUTURE }))).to.be.true
    })

    it('is not active once a scheduled cancellation has passed, even if the deleted webhook was missed', () => {
      expect(isActive(stripeRow({ cancel_at_period_end: true, current_period_end: PAST }))).to.be.false
      expect(isActive(stripeRow({ cancel_at: PAST, current_period_end: FUTURE }))).to.be.false
    })

    it('treats a period end of exactly now as ended', () => {
      expect(isActive(stripeRow({ cancel_at_period_end: true, current_period_end: NOW }))).to.be.false
    })

    it('stays active past the period end when it renews (renewal webhooks move the period forward)', () => {
      expect(isActive(stripeRow({ current_period_end: PAST }))).to.be.true
    })

    it('is not active once the subscription has ended', () => {
      expect(isActive(stripeRow({ ended_at: PAST }))).to.be.false
    })

    it('handles manual grants with and without an end date', () => {
      expect(isActive(manualRow({}))).to.be.true
      expect(isActive(manualRow({ expires_at: FUTURE }))).to.be.true
      expect(isActive(manualRow({ expires_at: PAST }))).to.be.false
      expect(isActive(manualRow({ status: 'canceled' }))).to.be.false
    })

    it('ignores Stripe fields on manual grants', () => {
      expect(isActive(manualRow({ cancel_at: PAST, ended_at: PAST }))).to.be.true
    })

    it('accepts date strings, as returned by some queries', () => {
      expect(isActive(manualRow({ expires_at: FUTURE.toISOString() }))).to.be.true
      expect(isActive(manualRow({ expires_at: PAST.toISOString() }))).to.be.false
    })

    it('is false for a missing row', () => {
      expect(isActive(null)).to.be.false
    })
  })

  describe('isOpenStripeSubscription', () => {
    const isOpen = row => HyloProSubscription.isOpenStripeSubscription(row, NOW)

    it('is open while active or unpaid/paused, so a second subscription is refused', () => {
      for (const status of ['active', 'trialing', 'past_due', 'unpaid', 'incomplete', 'paused']) {
        expect(isOpen(stripeRow({ status })), status).to.be.true
      }
    })

    it('is not open once the subscription is over', () => {
      expect(isOpen(stripeRow({ status: 'canceled', ended_at: PAST }))).to.be.false
      expect(isOpen(stripeRow({ status: 'incomplete_expired' }))).to.be.false
      expect(isOpen(stripeRow({ cancel_at_period_end: true, current_period_end: PAST }))).to.be.false
      expect(isOpen(stripeRow({ status: 'past_due', ended_at: PAST }))).to.be.false
    })

    it('ignores manual grants and missing rows', () => {
      expect(isOpen(manualRow({}))).to.be.false
      expect(isOpen(null)).to.be.false
    })
  })

  describe('for a group', () => {
    let group

    beforeEach(async () => {
      await setup.clearDb()
      group = await factories.group().save()
    })

    after(() => setup.clearDb())

    it('has no Pro without any rows', async () => {
      expect(await group.hasPro()).to.be.false
      expect(await HyloProSubscription.billingForGroup(group.id)).to.deep.equal({ subscription: null, grant: null, hasPro: false })
      expect(await HyloProSubscription.latestStripeCustomerId(group.id)).to.equal(null)
    })

    it('has Pro when any row is active, and shows the active Stripe subscription first', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_old', stripe_customer_id: 'cus_1', ended_at: PAST }).save()
      const grant = await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active' }).save()
      const paid = await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_new', stripe_customer_id: 'cus_1' }).save()

      expect(await group.hasPro()).to.be.true
      const billing = await HyloProSubscription.billingForGroup(group.id)
      expect(billing.subscription.id).to.equal(paid.id)
      expect(billing.grant.id).to.equal(grant.id)
      expect(billing.hasPro).to.be.true
      expect(await HyloProSubscription.latestStripeCustomerId(group.id)).to.equal('cus_1')
    })

    it('shows the latest lapsed row when nothing is active', async () => {
      await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', expires_at: PAST }).save()
      const lapsed = await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_lapsed', ended_at: PAST }).save()

      expect(await group.hasPro()).to.be.false
      const billing = await HyloProSubscription.billingForGroup(group.id)
      expect(billing.subscription.id).to.equal(lapsed.id)
      expect(billing.grant).to.equal(null)
      expect(billing.hasPro).to.be.false
    })

    it('still shows a past_due subscription while a manual grant gives Pro, so it can be managed', async () => {
      const grant = await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', expires_at: FUTURE }).save()
      const pastDue = await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'past_due', stripe_subscription_id: 'sub_past_due', stripe_customer_id: 'cus_1' }).save()
      // A newer, ended subscription doesn't hide the one still open
      await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'canceled', stripe_subscription_id: 'sub_newer_ended', stripe_customer_id: 'cus_1', ended_at: PAST }).save()

      const billing = await HyloProSubscription.billingForGroup(group.id, NOW)
      expect(billing.hasPro).to.be.true
      expect(billing.grant.id).to.equal(grant.id)
      expect(billing.subscription.id).to.equal(pastDue.id)
    })

    it('decides hasPro in SQL exactly as isActive does', async () => {
      const cases = [
        stripeRow({ current_period_end: FUTURE }),
        stripeRow({ status: 'trialing' }),
        stripeRow({ status: 'past_due' }),
        stripeRow({ status: 'paused' }),
        stripeRow({ status: 'canceled', ended_at: PAST }),
        stripeRow({ cancel_at_period_end: true, current_period_end: FUTURE }),
        stripeRow({ cancel_at_period_end: true, current_period_end: PAST }),
        stripeRow({ cancel_at_period_end: true, current_period_end: NOW }),
        stripeRow({ cancel_at_period_end: true }),
        stripeRow({ cancel_at: PAST }),
        stripeRow({ cancel_at: FUTURE }),
        stripeRow({ current_period_end: PAST }),
        stripeRow({ ended_at: PAST }),
        stripeRow({ ended_at: FUTURE }),
        manualRow({}),
        manualRow({ expires_at: FUTURE }),
        manualRow({ expires_at: PAST }),
        manualRow({ status: 'canceled' })
      ]
      for (const [i, attrs] of cases.entries()) {
        const caseGroup = await factories.group().save()
        await HyloProSubscription.forge({ group_id: caseGroup.id, stripe_subscription_id: attrs.source === 'stripe' ? `sub_case_${i}` : null, ...attrs }).save()
        expect(await HyloProSubscription.groupHasPro(caseGroup.id, NOW), JSON.stringify(attrs))
          .to.equal(HyloProSubscription.isActive(attrs, NOW))
      }
    })

    it('reports when access ends', async () => {
      const renewing = await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', current_period_end: FUTURE }).save()
      const cancelling = await HyloProSubscription.forge({ group_id: group.id, source: 'stripe', status: 'active', cancel_at_period_end: true, cancel_at: FUTURE, current_period_end: FUTURE }).save()
      const grant = await HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', expires_at: FUTURE }).save()

      expect(renewing.endsAt()).to.equal(null)
      expect(new Date(cancelling.endsAt()).getTime()).to.equal(FUTURE.getTime())
      expect(new Date(grant.endsAt()).getTime()).to.equal(FUTURE.getTime())
    })

    it('rejects an unknown source', async () => {
      await expect(
        HyloProSubscription.forge({ group_id: group.id, source: 'other', status: 'active' }).save()
      ).to.be.rejectedWith(/hylo_pro_subscriptions_source_check/)
    })
  })
})
