/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import HyloProAdminService from '../../services/HyloProAdminService'
import {
  hyloProMetrics,
  hyloProSubscriptions,
  hyloProPayments,
  grantHyloPro,
  updateHyloProGrant,
  revokeHyloProGrant,
  cancelHyloProSubscription,
  resumeHyloProSubscription,
  extendHyloProSubscription,
  refundHyloProPayment
} from './hyloProAdmin'

/* global bookshelf, HyloProSubscription */

const Stripe = require('stripe')

// test/setup/core makes every `new Stripe()` return this one shared mock client
const stripeMock = new Stripe('sk_test_fake')
const STUBBED_NAMESPACES = ['subscriptions', 'charges', 'refunds']

const DAY = 24 * 60 * 60
const PERIOD_END = 4102444800 // 2100-01-01, so rows stay active whatever the real date
const future = days => new Date(Date.now() + days * DAY * 1000)

function stripeSubscription (attrs) {
  return {
    id: 'sub_1',
    object: 'subscription',
    status: 'active',
    customer: 'cus_1',
    cancel_at_period_end: false,
    cancel_at: null,
    canceled_at: null,
    ended_at: null,
    trial_end: null,
    items: { data: [{ current_period_end: PERIOD_END, price: { id: 'price_m', recurring: { interval: 'month' } } }] },
    ...attrs
  }
}

describe('Hylo Pro management', () => {
  let staff, groupAdmin, member, group, otherGroup, saved, oldAdmins, stripeCalls, subscription, charges

  before(async () => {
    await setup.clearDb()
    staff = await factories.user().save()
    groupAdmin = await factories.user().save()
    member = await factories.user().save()
    group = await factories.group().save()
    otherGroup = await factories.group().save()
    await groupAdmin.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
    oldAdmins = process.env.HYLO_ADMINS
    process.env.HYLO_ADMINS = String(staff.id)
  })

  after(async () => {
    process.env.HYLO_ADMINS = oldAdmins
    await setup.clearDb()
  })

  beforeEach(() => {
    saved = {}
    for (const name of STUBBED_NAMESPACES) saved[name] = stripeMock[name]
    stripeCalls = []
    subscription = stripeSubscription({ metadata: { hylo_pro: 'true', group_id: String(group.id) } })
    charges = [
      { id: 'ch_1', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, refunded: false, description: 'Subscription creation', created: 1793748670 }
    ]
    stripeMock.subscriptions = {
      retrieve: async id => {
        stripeCalls.push(['retrieve', id])
        return subscription
      },
      update: async (id, params) => {
        stripeCalls.push(['update', id, params])
        subscription = { ...subscription, ...params }
        if (params.trial_end) {
          subscription.status = 'trialing'
          subscription.items = { data: [{ ...subscription.items.data[0], current_period_end: params.trial_end }] }
        }
        if (params.cancel_at_period_end === false || params.cancel_at === '') subscription.cancel_at = null
        return subscription
      },
      cancel: async id => {
        stripeCalls.push(['cancel', id])
        const now = Math.floor(Date.now() / 1000)
        subscription = { ...subscription, status: 'canceled', canceled_at: now, ended_at: now }
        return subscription
      }
    }
    stripeMock.charges = {
      list: async params => {
        stripeCalls.push(['charges.list', params])
        return { data: charges.filter(c => c.customer === params.customer) }
      },
      retrieve: async id => {
        const charge = charges.find(c => c.id === id)
        if (!charge) throw Object.assign(new Error('No such charge'), { code: 'resource_missing' })
        return charge
      }
    }
    stripeMock.refunds = {
      create: async params => {
        stripeCalls.push(['refunds.create', params])
        return { id: 're_1', amount: params.amount || 1000, currency: 'usd', status: 'succeeded' }
      }
    }
  })

  afterEach(async () => {
    for (const name of STUBBED_NAMESPACES) stripeMock[name] = saved[name]
    await bookshelf.knex('hylo_pro_subscriptions').del()
    await bookshelf.knex('hylo_pro_customers').del()
  })

  // The group's customer and our synced row for its Stripe subscription
  async function stripeRow (attrs = {}) {
    await bookshelf.knex('hylo_pro_customers').insert({ group_id: group.id, stripe_customer_id: 'cus_1' }).onConflict('group_id').ignore()
    return HyloProSubscription.forge({
      group_id: group.id,
      source: 'stripe',
      status: 'active',
      interval: 'month',
      stripe_subscription_id: 'sub_1',
      stripe_customer_id: 'cus_1',
      current_period_end: new Date(PERIOD_END * 1000),
      ...attrs
    }).save()
  }

  function grantRow (attrs = {}) {
    return HyloProSubscription.forge({ group_id: group.id, source: 'manual', status: 'active', granted_by_id: staff.id, ...attrs }).save()
  }

  describe('permissions', () => {
    // Every query and mutation, with arguments that would succeed for staff
    const calls = {
      hyloProMetrics: userId => hyloProMetrics(userId),
      hyloProSubscriptions: userId => hyloProSubscriptions(userId, {}),
      hyloProPayments: userId => hyloProPayments(userId, { groupId: group.id }),
      grantHyloPro: userId => grantHyloPro(userId, { groupId: group.id }),
      updateHyloProGrant: (userId, ids) => updateHyloProGrant(userId, { id: ids.grant, expiresAt: future(10) }),
      revokeHyloProGrant: (userId, ids) => revokeHyloProGrant(userId, { id: ids.grant }),
      cancelHyloProSubscription: (userId, ids) => cancelHyloProSubscription(userId, { id: ids.sub, immediately: true }),
      resumeHyloProSubscription: (userId, ids) => resumeHyloProSubscription(userId, { id: ids.sub }),
      extendHyloProSubscription: (userId, ids) => extendHyloProSubscription(userId, { id: ids.sub, days: 7 }),
      refundHyloProPayment: userId => refundHyloProPayment(userId, { groupId: group.id, chargeId: 'ch_1' })
    }

    for (const [name, call] of Object.entries(calls)) {
      it(`${name} refuses group administrators, members and logged-out users, and changes nothing`, async () => {
        const grant = await grantRow({ expires_at: future(5) })
        const sub = await stripeRow({ cancel_at_period_end: true })
        const ids = { grant: grant.id, sub: sub.id }
        const before = await bookshelf.knex('hylo_pro_subscriptions').orderBy('id')

        for (const userId of [groupAdmin.id, member.id, null]) {
          await expect(call(userId, ids)).to.be.rejectedWith(/Admin access required/)
        }
        expect(stripeCalls).to.deep.equal([])
        expect(await bookshelf.knex('hylo_pro_subscriptions').orderBy('id')).to.deep.equal(before)
      })
    }

    it('lets Hylo staff through', async () => {
      const result = await hyloProMetrics(staff.id)
      expect(result.activeGroups).to.equal(0)
    })
  })

  describe('grants', () => {
    it('grants Pro with an end date and note, recorded with who granted it', async () => {
      const expiresAt = future(30)
      const result = await grantHyloPro(staff.id, { groupId: group.id, expiresAt: expiresAt.toISOString(), note: '  Partner org  ' })
      expect(result).to.include({ source: 'manual', status: 'active', active: true, note: 'Partner org' })
      expect(result.group).to.deep.equal({ id: group.id, name: group.get('name'), slug: group.get('slug') })
      expect(result.grantedBy.id).to.equal(staff.id)
      expect(result.expiresAt.getTime()).to.equal(expiresAt.getTime())
      expect(await group.hasPro()).to.be.true
    })

    it('accepts a group slug and no end date', async () => {
      const result = await grantHyloPro(staff.id, { groupId: group.get('slug') })
      expect(result.group.id).to.equal(group.id)
      expect(result.expiresAt).to.be.null
      expect(result.endsAt).to.be.null
    })

    it('refuses a second active grant, a past end date, unknown groups and spaces', async () => {
      await grantHyloPro(staff.id, { groupId: group.id })
      await expect(grantHyloPro(staff.id, { groupId: group.id })).to.be.rejectedWith(/already has an active Hylo Pro grant/)
      await expect(grantHyloPro(staff.id, { groupId: otherGroup.id, expiresAt: future(-1).toISOString() })).to.be.rejectedWith(/must be in the future/)
      await expect(grantHyloPro(staff.id, { groupId: otherGroup.id, expiresAt: 'not a date' })).to.be.rejectedWith(/not a valid date/)
      await expect(grantHyloPro(staff.id, { groupId: 'no-such-group-slug' })).to.be.rejectedWith(/Group not found/)
      const space = await factories.group({ type: 'space', parent_id: group.id }).save()
      await expect(grantHyloPro(staff.id, { groupId: space.id })).to.be.rejectedWith(/not spaces/)
    })

    it('allows a new grant once the previous one has expired', async () => {
      await grantRow({ expires_at: future(-1) })
      const result = await grantHyloPro(staff.id, { groupId: group.id })
      expect(result.active).to.be.true
    })

    it('changes the end date and note of a grant, and re-activates an expired grant', async () => {
      const grant = await grantRow({ expires_at: future(-1), note: 'old' })
      expect(await group.hasPro()).to.be.false

      const result = await updateHyloProGrant(staff.id, { id: grant.id, expiresAt: future(60).toISOString(), note: 'renewed' })
      expect(result).to.include({ active: true, note: 'renewed' })
      expect(await group.hasPro()).to.be.true

      const noEnd = await updateHyloProGrant(staff.id, { id: grant.id, expiresAt: null })
      expect(noEnd.expiresAt).to.be.null
      expect(noEnd.note).to.equal('renewed')
    })

    it('leaves the end date alone when only the note changes', async () => {
      const expiresAt = future(10)
      const grant = await grantRow({ expires_at: expiresAt })
      const result = await updateHyloProGrant(staff.id, { id: grant.id, note: 'just a note' })
      expect(result.expiresAt.getTime()).to.equal(expiresAt.getTime())
    })

    it('refuses to re-activate an expired grant while another grant is active', async () => {
      const expired = await grantRow({ expires_at: future(-1) })
      await grantRow()
      await expect(updateHyloProGrant(staff.id, { id: expired.id, expiresAt: future(5).toISOString() }))
        .to.be.rejectedWith(/another active Hylo Pro grant/)
    })

    it('revokes a grant, keeping the row as a record', async () => {
      const grant = await grantRow()
      const result = await revokeHyloProGrant(staff.id, { id: grant.id })
      expect(result).to.include({ status: 'canceled', active: false })
      expect(result.endedAt).to.be.an.instanceof(Date)
      expect(await group.hasPro()).to.be.false

      await expect(revokeHyloProGrant(staff.id, { id: grant.id })).to.be.rejectedWith(/already revoked/)
      await expect(updateHyloProGrant(staff.id, { id: grant.id, expiresAt: null })).to.be.rejectedWith(/was revoked/)
    })

    it('refuses grant actions on Stripe rows', async () => {
      const sub = await stripeRow()
      await expect(revokeHyloProGrant(staff.id, { id: sub.id })).to.be.rejectedWith(/not a manual grant/)
      await expect(updateHyloProGrant(staff.id, { id: sub.id, expiresAt: null })).to.be.rejectedWith(/not a manual grant/)
    })
  })

  describe('Stripe subscriptions', () => {
    it('cancels at period end on the platform account, then re-syncs the row from Stripe', async () => {
      const sub = await stripeRow()
      const result = await cancelHyloProSubscription(staff.id, { id: sub.id })
      const update = stripeCalls.find(c => c[0] === 'update')
      expect(update).to.deep.equal(['update', 'sub_1', { cancel_at_period_end: true }])
      // No stripeAccount option: these calls take (id, params) only
      expect(update.length).to.equal(3)
      expect(stripeCalls.filter(c => c[0] === 'retrieve').length).to.be.at.least(1)
      expect(result).to.include({ cancelAtPeriodEnd: true, active: true })
    })

    it('cancels immediately', async () => {
      const sub = await stripeRow()
      const result = await cancelHyloProSubscription(staff.id, { id: sub.id, immediately: true })
      expect(stripeCalls[0]).to.deep.equal(['cancel', 'sub_1'])
      expect(result).to.include({ status: 'canceled', active: false })
      expect(await group.hasPro()).to.be.false
      await expect(cancelHyloProSubscription(staff.id, { id: sub.id })).to.be.rejectedWith(/already ended/)
    })

    it('undoes a scheduled cancellation', async () => {
      subscription.cancel_at_period_end = true
      subscription.cancel_at = PERIOD_END
      const sub = await stripeRow({ cancel_at_period_end: true, cancel_at: new Date(PERIOD_END * 1000) })
      const result = await resumeHyloProSubscription(staff.id, { id: sub.id })
      expect(stripeCalls.find(c => c[0] === 'update')).to.deep.equal(['update', 'sub_1', { cancel_at_period_end: false }])
      expect(result.cancelAtPeriodEnd).to.be.false
    })

    it('undoes a cancellation scheduled for a fixed date', async () => {
      subscription.cancel_at = PERIOD_END - DAY
      const sub = await stripeRow()
      await resumeHyloProSubscription(staff.id, { id: sub.id })
      expect(stripeCalls.find(c => c[0] === 'update')).to.deep.equal(['update', 'sub_1', { cancel_at: '' }])
    })

    it('refuses to undo when nothing is scheduled', async () => {
      const sub = await stripeRow()
      await expect(resumeHyloProSubscription(staff.id, { id: sub.id })).to.be.rejectedWith(/not set to cancel/)
    })

    it('extends by pushing trial_end past the current period end, without proration', async () => {
      const sub = await stripeRow()
      const result = await extendHyloProSubscription(staff.id, { id: sub.id, days: 14 })
      const update = stripeCalls.find(c => c[0] === 'update')
      expect(update).to.deep.equal(['update', 'sub_1', { trial_end: PERIOD_END + 14 * DAY, proration_behavior: 'none' }])
      expect(result).to.include({ status: 'trialing', active: true })
      expect(result.currentPeriodEnd.getTime()).to.equal((PERIOD_END + 14 * DAY) * 1000)
    })

    it('extends an already-trialing subscription from the end of its trial', async () => {
      subscription.status = 'trialing'
      subscription.trial_end = PERIOD_END + DAY
      const sub = await stripeRow({ status: 'trialing' })
      await extendHyloProSubscription(staff.id, { id: sub.id, days: 1 })
      expect(stripeCalls.find(c => c[0] === 'update')[2].trial_end).to.equal(PERIOD_END + 2 * DAY)
    })

    it('refuses to extend past_due or fixed-date-cancelling subscriptions, or by a bad number of days', async () => {
      const sub = await stripeRow()
      for (const days of [0, -3, 1.5, 367]) {
        await expect(extendHyloProSubscription(staff.id, { id: sub.id, days })).to.be.rejectedWith(/days must be a whole number/)
      }
      subscription.status = 'past_due'
      await expect(extendHyloProSubscription(staff.id, { id: sub.id, days: 7 })).to.be.rejectedWith(/Only an active or trialing/)
      subscription.status = 'active'
      subscription.cancel_at = PERIOD_END - DAY
      await expect(extendHyloProSubscription(staff.id, { id: sub.id, days: 7 })).to.be.rejectedWith(/cancel on a fixed date/)
      expect(stripeCalls.filter(c => c[0] === 'update')).to.deep.equal([])
    })

    it('refuses Stripe actions on grants', async () => {
      const grant = await grantRow()
      await expect(cancelHyloProSubscription(staff.id, { id: grant.id })).to.be.rejectedWith(/not a Stripe subscription/)
      await expect(extendHyloProSubscription(staff.id, { id: grant.id, days: 3 })).to.be.rejectedWith(/not a Stripe subscription/)
      await expect(resumeHyloProSubscription(staff.id, { id: 999999 })).to.be.rejectedWith(/not found/)
    })
  })

  describe('payments and refunds', () => {
    it("lists the group's Pro customer's charges", async () => {
      await stripeRow()
      const payments = await hyloProPayments(staff.id, { groupId: group.id })
      expect(stripeCalls[0]).to.deep.equal(['charges.list', { customer: 'cus_1', limit: 20 }])
      expect(payments).to.have.length(1)
      expect(payments[0]).to.include({ id: 'ch_1', amount: 1000, amountRefunded: 0, paid: true })
    })

    it('returns no payments for a group without a Pro customer', async () => {
      expect(await hyloProPayments(staff.id, { groupId: otherGroup.id })).to.deep.equal([])
      expect(stripeCalls).to.deep.equal([])
    })

    it('refunds in full or in part, tagging the refund', async () => {
      await stripeRow()
      const full = await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1' })
      expect(full).to.include({ id: 're_1', amount: 1000 })
      expect(stripeCalls[0]).to.deep.equal(['refunds.create', {
        charge: 'ch_1',
        metadata: { hylo_pro: 'true', group_id: String(group.id), refunded_by_id: String(staff.id) }
      }])

      await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', amount: 250 })
      expect(stripeCalls[1][1].amount).to.equal(250)
    })

    it("refuses another customer's charge, too much, and fully refunded charges", async () => {
      await stripeRow()
      charges.push({ id: 'ch_other', customer: 'cus_other', amount: 1000, amount_refunded: 0, paid: true })
      charges.push({ id: 'ch_done', customer: 'cus_1', amount: 1000, amount_refunded: 1000, paid: true })
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_other' })).to.be.rejectedWith(/isn't one of this group's/)
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', amount: 1001 })).to.be.rejectedWith(/amount must be/)
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_done' })).to.be.rejectedWith(/Nothing left to refund/)
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_missing' })).to.be.rejectedWith(/Payment not found/)
      await expect(refundHyloProPayment(staff.id, { groupId: otherGroup.id, chargeId: 'ch_1' })).to.be.rejectedWith(/no Hylo Pro payments/)
      expect(stripeCalls.filter(c => c[0] === 'refunds.create')).to.deep.equal([])
    })
  })

  describe('metrics and listing', () => {
    it('counts groups, revenue, cancellations and past_due from the table', async () => {
      const now = new Date()
      // group: monthly subscription set to cancel, plus an expiring grant
      await stripeRow({ cancel_at_period_end: true, canceled_at: now })
      await grantRow({ expires_at: future(10) })
      // otherGroup: yearly subscription
      await bookshelf.knex('hylo_pro_subscriptions').insert([
        { group_id: otherGroup.id, source: 'stripe', status: 'active', interval: 'year', stripe_subscription_id: 'sub_y', current_period_end: new Date(PERIOD_END * 1000) },
        { group_id: otherGroup.id, source: 'stripe', status: 'trialing', interval: 'month', stripe_subscription_id: 'sub_t', current_period_end: new Date(PERIOD_END * 1000) },
        { group_id: otherGroup.id, source: 'stripe', status: 'past_due', interval: 'month', stripe_subscription_id: 'sub_pd', current_period_start: new Date(now - 10 * DAY * 1000), current_period_end: new Date(PERIOD_END * 1000) },
        { group_id: otherGroup.id, source: 'stripe', status: 'canceled', interval: 'month', stripe_subscription_id: 'sub_old', canceled_at: now, ended_at: now, current_period_end: now },
        { group_id: otherGroup.id, source: 'manual', status: 'canceled', ended_at: now }
      ])

      const metrics = await hyloProMetrics(staff.id)
      expect(metrics).to.include({
        activeGroups: 2,
        stripeGroups: 2,
        manualGroups: 1,
        monthlySubscriptions: 2, // sub_1 and the trialing one; past_due is past its grace
        yearlySubscriptions: 1,
        trialing: 1,
        cancelling: 1,
        pastDue: 1,
        grantsExpiringSoon: 1,
        mrrCents: 1000 + HyloProAdminService.monthlyAmount('year'),
        currency: 'usd'
      })
      expect(metrics.months).to.have.length(6)
      const thisMonth = metrics.months[5]
      expect(thisMonth.month).to.equal(now.toISOString().slice(0, 7))
      expect(thisMonth).to.include({ newSubscriptions: 5, cancellations: 2, ended: 1, grants: 2 })
    })

    it('lists rows by filter and group search, with group and granter', async () => {
      await stripeRow()
      await grantRow({ note: 'friend' })
      await bookshelf.knex('hylo_pro_subscriptions').insert({ group_id: otherGroup.id, source: 'stripe', status: 'past_due', stripe_subscription_id: 'sub_pd', current_period_start: new Date(Date.now() - 10 * DAY * 1000), current_period_end: new Date(PERIOD_END * 1000) })

      const active = await hyloProSubscriptions(staff.id, {})
      expect(active.total).to.equal(2)
      expect(active.items.map(i => i.source).sort()).to.deep.equal(['manual', 'stripe'])
      const grant = active.items.find(i => i.source === 'manual')
      expect(grant.grantedBy).to.deep.equal({ id: staff.id, name: staff.get('name') })
      expect(grant.group.slug).to.equal(group.get('slug'))

      expect((await hyloProSubscriptions(staff.id, { filter: 'past_due' })).items.map(i => i.stripeSubscriptionId)).to.deep.equal(['sub_pd'])
      expect((await hyloProSubscriptions(staff.id, { filter: 'all' })).total).to.equal(3)
      expect((await hyloProSubscriptions(staff.id, { filter: 'manual' })).total).to.equal(1)
      expect((await hyloProSubscriptions(staff.id, { filter: 'all', search: otherGroup.get('name') })).total).to.equal(1)
      expect((await hyloProSubscriptions(staff.id, { filter: 'all', search: '%' })).total).to.equal(0)

      const page = await hyloProSubscriptions(staff.id, { filter: 'all', first: 2 })
      expect(page.items).to.have.length(2)
      expect(page.hasMore).to.be.true

      await expect(hyloProSubscriptions(staff.id, { filter: 'bogus' })).to.be.rejectedWith(/filter must be one of/)
    })
  })
})
