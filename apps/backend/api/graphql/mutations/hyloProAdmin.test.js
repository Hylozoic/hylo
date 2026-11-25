/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import HyloProAdminService from '../../services/HyloProAdminService'
import HyloProService from '../../services/HyloProService'
import {
  hyloProMetrics,
  hyloProSubscriptions,
  hyloProGroups,
  hyloProPayments,
  hyloProChargeEvents,
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
const STUBBED_NAMESPACES = ['subscriptions', 'charges', 'refunds', 'disputes', 'rawRequest']

const DAY = 24 * 60 * 60
const PERIOD_END = 4102444800 // 2100-01-01, so rows stay active whatever the real date
const future = days => new Date(Date.now() + days * DAY * 1000)
const nowSeconds = () => Math.floor(Date.now() / 1000)

// Resolves once some connection is waiting for a Postgres advisory lock (i.e. blocked in withLock)
async function waitForLockWaiter () {
  for (let i = 0; i < 100; i++) {
    const { rows } = await bookshelf.knex.raw("select count(*) as count from pg_locks where locktype = 'advisory' and not granted")
    if (Number(rows[0].count) > 0) return
    await new Promise(resolve => setTimeout(resolve, 20))
  }
  throw new Error('Nothing waited for the lock')
}

// Takes `key`'s lock in its own transaction and holds it until release(fn) runs fn(trx) and commits
async function holdLock (key) {
  let release
  let locked
  const lockedPromise = new Promise(resolve => { locked = resolve })
  const done = HyloProService.withLock(key, trx => new Promise((resolve, reject) => {
    release = fn => Promise.resolve(fn ? fn(trx) : null).then(resolve, reject)
    locked()
  }))
  await lockedPromise
  return { release: async fn => { release(fn); await done } }
}

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
  let staff, groupAdmin, member, group, otherGroup, saved, oldAdmins, stripeCalls, subscription, charges, disputeStatus, invoiceSubscriptions

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
      { id: 'ch_1', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, refunded: false, description: 'Subscription creation', created: 1793748670, payment_intent: 'pi_1' }
    ]
    disputeStatus = 'needs_response'
    // Payment intent (or charge) id -> the subscription whose invoice it paid
    invoiceSubscriptions = { pi_1: 'sub_1' }
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
        const mine = charges.filter(c => c.customer === params.customer)
        const start = params.starting_after ? mine.findIndex(c => c.id === params.starting_after) + 1 : 0
        const data = mine.slice(start, start + params.limit)
        return { data, has_more: start + params.limit < mine.length }
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
    stripeMock.disputes = {
      list: async params => {
        stripeCalls.push(['disputes.list', params])
        if (disputeStatus === 'unreadable') throw new Error('Stripe is down')
        return { data: [{ id: 'dp_1', charge: params.charge, status: disputeStatus }] }
      }
    }
    // GET /v1/invoice_payments?payment[type]=...&payment[payment_intent|charge]=..., the clover API's
    // charge -> invoice link; the invoice's subscription is under parent.subscription_details
    stripeMock.rawRequest = async (method, path, params) => {
      stripeCalls.push(['rawRequest', method, path])
      const query = new URLSearchParams(path.split('?')[1])
      const paymentId = query.get('payment[payment_intent]') || query.get('payment[charge]')
      const sub = invoiceSubscriptions[paymentId]
      if (!path.startsWith('/v1/invoice_payments?') || method !== 'GET' || params !== null || query.get('expand[]') !== 'data.invoice') {
        throw new Error(`Unexpected rawRequest ${method} ${path}`)
      }
      return { data: sub ? [{ id: 'inpay_1', invoice: { id: 'in_1', parent: { subscription_details: { subscription: sub } } } }] : [] }
    }
  })

  afterEach(async () => {
    for (const name of STUBBED_NAMESPACES) stripeMock[name] = saved[name]
    await bookshelf.knex('hylo_pro_subscriptions').del()
    await bookshelf.knex('groups').whereNotNull('hylo_pro_stripe_customer_id').update({ hylo_pro_stripe_customer_id: null })
    await bookshelf.knex('stripe_logs').del()
  })

  // The group's customer and our synced row for its Stripe subscription
  async function stripeRow (attrs = {}) {
    await bookshelf.knex('groups').where({ id: group.id }).update({ hylo_pro_stripe_customer_id: 'cus_1' })
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
      hyloProGroups: userId => hyloProGroups(userId, { slugOrId: group.get('slug') }),
      hyloProPayments: userId => hyloProPayments(userId, { groupId: group.id }),
      hyloProChargeEvents: userId => hyloProChargeEvents(userId, { groupId: group.id }),
      grantHyloPro: userId => grantHyloPro(userId, { groupId: group.id }),
      updateHyloProGrant: (userId, ids) => updateHyloProGrant(userId, { id: ids.grant, expiresAt: future(10) }),
      revokeHyloProGrant: (userId, ids) => revokeHyloProGrant(userId, { id: ids.grant }),
      cancelHyloProSubscription: (userId, ids) => cancelHyloProSubscription(userId, { id: ids.sub, immediately: true }),
      resumeHyloProSubscription: (userId, ids) => resumeHyloProSubscription(userId, { id: ids.sub }),
      extendHyloProSubscription: (userId, ids) => extendHyloProSubscription(userId, { id: ids.sub, days: 7 }),
      refundHyloProPayment: (userId, ids) => refundHyloProPayment(userId, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: ids.sub })
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

    it('grants with no end date', async () => {
      const result = await grantHyloPro(staff.id, { groupId: group.id })
      expect(result.group.id).to.equal(group.id)
      expect(result.expiresAt).to.be.null
      expect(result.endsAt).to.be.null
    })

    it('grants the Pro tier with no overrides by default', async () => {
      const result = await grantHyloPro(staff.id, { groupId: group.id })
      expect(result.tier).to.equal('pro')
      expect(result.features).to.deep.equal([])
      expect(await group.hasProFeature('designedViews')).to.be.true
      expect(await group.hasProFeature('recording')).to.be.false
    })

    it('grants another tier with single features added or removed, storing only the differences', async () => {
      const result = await grantHyloPro(staff.id, {
        groupId: group.id,
        tier: 'pro_plus',
        features: [
          { key: 'singleSignOn', enabled: true },
          { key: 'recording', enabled: false },
          { key: 'designedViews', enabled: true } // already in the tier: not an override
        ]
      })
      expect(result.tier).to.equal('pro_plus')
      expect(result.features).to.have.deep.members([{ key: 'singleSignOn', enabled: true }, { key: 'recording', enabled: false }])
      const row = await HyloProSubscription.where({ id: result.id }).fetch()
      expect(row.get('features')).to.deep.equal({ singleSignOn: true, recording: false })
      const features = await group.proFeatures()
      expect(features).to.include({ designedViews: true, transcriptions: true, singleSignOn: true, recording: false, federation: false })
    })

    it('refuses unknown tiers and feature keys, granting nothing', async () => {
      await expect(grantHyloPro(staff.id, { groupId: group.id, tier: 'gold' })).to.be.rejectedWith(/tier must be one of: pro, pro_plus, custom/)
      await expect(grantHyloPro(staff.id, { groupId: group.id, features: [{ key: 'groupTheme', enabled: true }] })).to.be.rejectedWith(/Unknown Hylo Pro feature: groupTheme/)
      expect(await group.hasPro()).to.be.false
    })

    it('changes the tier and overrides of a grant', async () => {
      const grant = await grantRow({ tier: 'pro', features: { recording: true } })
      expect(await group.hasProFeature('recording')).to.be.true

      // A new tier keeps the chosen features, re-read against it: recording is now in the bundle, so no override is left
      const upgraded = await updateHyloProGrant(staff.id, { id: grant.id, tier: 'pro_plus' })
      expect(upgraded.tier).to.equal('pro_plus')
      expect(upgraded.features).to.deep.equal([])
      expect(await group.hasProFeature('transcriptions')).to.be.true

      const trimmed = await updateHyloProGrant(staff.id, { id: grant.id, features: [{ key: 'transcriptions', enabled: false }] })
      expect(trimmed.features).to.deep.equal([{ key: 'transcriptions', enabled: false }])
      expect(await group.hasProFeature('transcriptions')).to.be.false

      const plain = await updateHyloProGrant(staff.id, { id: grant.id, features: [] })
      expect(plain.features).to.deep.equal([])
      expect((await HyloProSubscription.where({ id: grant.id }).fetch()).get('features')).to.be.null
      expect(await group.hasProFeature('transcriptions')).to.be.true

      await expect(updateHyloProGrant(staff.id, { id: grant.id, features: [{ key: 'nope', enabled: true }] })).to.be.rejectedWith(/Unknown Hylo Pro feature: nope/)
    })

    it('grants by id only, so an all-digit slug can never pick the wrong group', async () => {
      await expect(grantHyloPro(staff.id, { groupId: group.get('slug') })).to.be.rejectedWith(/Group not found/)
      await expect(grantHyloPro(staff.id, { groupId: '1e3' })).to.be.rejectedWith(/Group not found/)
      // Too big for a bigint id: not found, rather than a database error
      await expect(grantHyloPro(staff.id, { groupId: '99999999999999999999' })).to.be.rejectedWith(/^Group not found$/)
      await expect(hyloProPayments(staff.id, { groupId: '9223372036854775808' })).to.be.rejectedWith(/^Group not found$/)
      expect(await group.hasPro()).to.be.false
    })

    it('finds the groups a slug or id could mean, listing both when an all-digit slug differs from the id', async () => {
      expect(await hyloProGroups(staff.id, { slugOrId: ` ${group.get('slug')} ` })).to.deep.equal([
        { id: group.id, name: group.get('name'), slug: group.get('slug'), type: group.get('type') || null }
      ])
      expect((await hyloProGroups(staff.id, { slugOrId: String(otherGroup.id) })).map(g => g.id)).to.deep.equal([otherGroup.id])
      expect(await hyloProGroups(staff.id, { slugOrId: 'no-such-group-slug' })).to.deep.equal([])
      expect(await hyloProGroups(staff.id, { slugOrId: '  ' })).to.deep.equal([])
      // All digits but too big for an id: only a slug could match
      expect(await hyloProGroups(staff.id, { slugOrId: '99999999999999999999' })).to.deep.equal([])
      expect((await hyloProGroups(staff.id, { slugOrId: `00${otherGroup.id}` })).map(g => g.id)).to.deep.equal([otherGroup.id])

      // A group whose slug is another group's id
      const digits = await factories.group({ slug: String(otherGroup.id) }).save()
      const matches = await hyloProGroups(staff.id, { slugOrId: String(otherGroup.id) })
      expect(matches.map(g => g.id)).to.deep.equal([digits.id, otherGroup.id])
      await bookshelf.knex('groups').where({ id: digits.id }).update({ active: false })
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

    it('updateGrant re-reads the grant inside the lock, so a revoke made while it waited is seen', async () => {
      const grant = await grantRow({ expires_at: future(5) })
      const lock = await holdLock(`hylo_pro_grant:${group.id}`)
      const update = updateHyloProGrant(staff.id, { id: grant.id, expiresAt: future(60).toISOString() })
      const settled = update.then(() => 'resolved', error => error)
      await waitForLockWaiter()
      await lock.release(trx => trx('hylo_pro_subscriptions').where({ id: grant.id }).update({ status: 'canceled', ended_at: new Date() }))

      const outcome = await settled
      expect(outcome).to.be.an.instanceof(Error)
      expect(outcome.message).to.match(/was revoked/)
      const row = await bookshelf.knex('hylo_pro_subscriptions').where({ id: grant.id }).first()
      expect(row.expires_at.getTime()).to.be.below(future(10).getTime())
    })

    it('revokeGrant waits for the group\'s grant lock', async () => {
      const grant = await grantRow()
      const lock = await holdLock(`hylo_pro_grant:${group.id}`)
      const revoke = revokeHyloProGrant(staff.id, { id: grant.id })
      await waitForLockWaiter()
      expect((await bookshelf.knex('hylo_pro_subscriptions').where({ id: grant.id }).first()).status).to.equal('active')
      await lock.release()
      expect((await revoke).status).to.equal('canceled')
    })

    it('revokes a grant, keeping the row as a record', async () => {
      const grant = await grantRow()
      const result = await revokeHyloProGrant(staff.id, { id: grant.id })
      expect(result).to.include({ status: 'canceled', active: false })
      expect(result.endedAt).to.be.an.instanceof(Date)
      expect(await group.hasPro()).to.be.false

      await expect(revokeHyloProGrant(staff.id, { id: grant.id })).to.be.rejectedWith(/already revoked/)
      await expect(revokeHyloProGrant(staff.id, { id: '99999999999999999999' })).to.be.rejectedWith(/^Hylo Pro subscription or grant not found$/)
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

    // Sets the Stripe subscription's current period to end `days` from now
    function periodEndsIn (days) {
      const end = nowSeconds() + days * DAY
      subscription.items = { data: [{ ...subscription.items.data[0], current_period_end: end }] }
      return end
    }

    it('extends by pushing trial_end past the current period end, without proration', async () => {
      const periodEnd = periodEndsIn(20)
      const sub = await stripeRow()
      const result = await extendHyloProSubscription(staff.id, { id: sub.id, days: 14 })
      const update = stripeCalls.find(c => c[0] === 'update')
      expect(update).to.deep.equal(['update', 'sub_1', { trial_end: periodEnd + 14 * DAY, proration_behavior: 'none' }])
      expect(result).to.include({ status: 'trialing', active: true })
      expect(result.currentPeriodEnd.getTime()).to.equal((periodEnd + 14 * DAY) * 1000)
    })

    it('extends an already-trialing subscription from the end of its trial', async () => {
      const periodEnd = periodEndsIn(20)
      subscription.status = 'trialing'
      subscription.trial_end = periodEnd + DAY
      const sub = await stripeRow({ status: 'trialing' })
      await extendHyloProSubscription(staff.id, { id: sub.id, days: 1 })
      expect(stripeCalls.find(c => c[0] === 'update')[2].trial_end).to.equal(periodEnd + 2 * DAY)
    })

    it("refuses to extend past Stripe's 730-day trial limit, saying how many days are left, also after earlier extensions", async () => {
      periodEndsIn(700)
      const sub = await stripeRow()

      const tooFar = await extendHyloProSubscription(staff.id, { id: sub.id, days: 31 }).catch(e => e)
      expect(tooFar.message).to.match(/at most 29 more days/)
      expect(tooFar.extensions).to.include({ code: HyloProAdminService.EXTEND_LIMIT, maxDays: 29, maxTrialDays: 730 })
      expect(stripeCalls.filter(c => c[0] === 'update')).to.deep.equal([])

      // The most that's left works, and leaves trial_end within Stripe's limit
      await extendHyloProSubscription(staff.id, { id: sub.id, days: 29 })
      const trialEnd = stripeCalls.find(c => c[0] === 'update')[2].trial_end
      expect(trialEnd).to.be.at.most(nowSeconds() + 730 * DAY)

      // Now at the limit: any further extension is refused
      const atLimit = await extendHyloProSubscription(staff.id, { id: sub.id, days: 1 }).catch(e => e)
      expect(atLimit.message).to.match(/already extended as far as Stripe allows/)
      expect(atLimit.extensions).to.include({ code: HyloProAdminService.EXTEND_LIMIT, maxDays: 0 })
      expect(stripeCalls.filter(c => c[0] === 'update')).to.have.length(1)
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
      expect(stripeCalls[1]).to.deep.equal(['rawRequest', 'GET', '/v1/invoice_payments?payment[type]=payment_intent&payment[payment_intent]=pi_1&expand[]=data.invoice&limit=10'])
      expect(payments.hasMore).to.be.false
      expect(payments.items).to.have.length(1)
      expect(payments.items[0]).to.include({ id: 'ch_1', amount: 1000, amountRefunded: 0, paid: true, disputed: false, disputeStatus: null, refundBlock: null, subscriptionId: 'sub_1' })
    })

    it('pages through charges with `after`', async () => {
      await stripeRow()
      charges = Array.from({ length: 25 }, (_, i) => ({ id: `ch_${i}`, customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, created: 1793748670 - i }))
      const first = await hyloProPayments(staff.id, { groupId: group.id })
      expect(first.items).to.have.length(20)
      expect(first.hasMore).to.be.true
      const second = await hyloProPayments(staff.id, { groupId: group.id, after: first.items[19].id })
      expect(stripeCalls.filter(c => c[0] === 'charges.list')[1]).to.deep.equal(['charges.list', { customer: 'cus_1', limit: 20, starting_after: 'ch_19' }])
      expect(second.items.map(p => p.id)).to.deep.equal(['ch_20', 'ch_21', 'ch_22', 'ch_23', 'ch_24'])
      expect(second.hasMore).to.be.false
    })

    it('marks disputed charges with their dispute status', async () => {
      await stripeRow()
      charges.push({ id: 'ch_disputed', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, disputed: true, created: 1793748600 })
      const payments = await hyloProPayments(staff.id, { groupId: group.id })
      expect(payments.items.find(p => p.id === 'ch_disputed')).to.include({ disputed: true, disputeStatus: 'needs_response', refundBlock: 'dispute_open' })
      expect(stripeCalls.filter(c => c[0] === 'disputes.list')).to.deep.equal([['disputes.list', { charge: 'ch_disputed', limit: 1 }]])
    })

    it('says which disputes block a refund: open chargebacks and lost ones, not inquiries or won disputes', async () => {
      await stripeRow()
      charges.push({ id: 'ch_disputed', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, disputed: true, created: 1793748600 })
      const expected = {
        needs_response: 'dispute_open',
        under_review: 'dispute_open',
        appeal_needs_response: 'dispute_open',
        appeal_under_review: 'dispute_open',
        unreadable: 'dispute_open',
        lost: 'dispute_lost',
        warning_needs_response: null,
        warning_under_review: null,
        warning_closed: null,
        won: null,
        prevented: null
      }
      for (const [status, block] of Object.entries(expected)) {
        disputeStatus = status
        const payments = await hyloProPayments(staff.id, { groupId: group.id })
        expect(payments.items.find(p => p.id === 'ch_disputed').refundBlock, status).to.equal(block)
      }
    })

    it('gives each charge the subscription it paid for, looking up charges without a payment intent by charge id', async () => {
      await stripeRow()
      charges.push({ id: 'ch_old', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, created: 1793748600, payment_intent: null })
      charges.push({ id: 'ch_none', customer: 'cus_1', amount: 1000, amount_refunded: 0, currency: 'usd', status: 'succeeded', paid: true, created: 1793748500, payment_intent: 'pi_none' })
      invoiceSubscriptions.ch_old = 'sub_old'
      const payments = await hyloProPayments(staff.id, { groupId: group.id })
      expect(payments.items.map(p => [p.id, p.subscriptionId])).to.deep.equal([['ch_1', 'sub_1'], ['ch_old', 'sub_old'], ['ch_none', null]])
      expect(stripeCalls).to.deep.include(['rawRequest', 'GET', '/v1/invoice_payments?payment[type]=charge&payment[charge]=ch_old&expand[]=data.invoice&limit=10'])

      // A failed lookup leaves the subscription unknown rather than failing the list
      stripeMock.rawRequest = async () => { throw new Error('Stripe is down') }
      const again = await hyloProPayments(staff.id, { groupId: group.id })
      expect(again.items.map(p => p.subscriptionId)).to.deep.equal([null, null, null])
    })

    it('returns no payments for a group without a Pro customer', async () => {
      expect(await hyloProPayments(staff.id, { groupId: otherGroup.id })).to.deep.equal({ items: [], hasMore: false })
      expect(stripeCalls).to.deep.equal([])
    })

    it('refuses a slug instead of a group id with a clear error', async () => {
      await expect(hyloProPayments(staff.id, { groupId: group.get('slug') })).to.be.rejectedWith(/Group not found/)
      await expect(refundHyloProPayment(staff.id, { groupId: group.get('slug'), chargeId: 'ch_1' })).to.be.rejectedWith(/Group not found/)
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
      charges.push({ id: 'ch_disputed', customer: 'cus_1', amount: 1000, amount_refunded: 0, paid: true, disputed: true })
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_disputed' })).to.be.rejectedWith(/open dispute/)
      expect(stripeCalls.filter(c => c[0] === 'refunds.create')).to.deep.equal([])
    })

    it('refuses refunds while a chargeback is open or after it was lost, and allows them for inquiries and won disputes', async () => {
      await stripeRow()
      charges.push({ id: 'ch_disputed', customer: 'cus_1', amount: 1000, amount_refunded: 0, paid: true, disputed: true })
      for (const status of ['needs_response', 'under_review', 'appeal_needs_response', 'appeal_under_review', 'unreadable']) {
        disputeStatus = status
        await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_disputed' }), status).to.be.rejectedWith(/open dispute/)
      }
      disputeStatus = 'lost'
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_disputed' })).to.be.rejectedWith(/dispute was lost/)
      expect(stripeCalls.filter(c => c[0] === 'refunds.create')).to.deep.equal([])

      const allowed = ['warning_needs_response', 'warning_under_review', 'warning_closed', 'won', 'prevented']
      for (const status of allowed) {
        disputeStatus = status
        expect(await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_disputed', amount: 100 }), status).to.include({ id: 're_1' })
      }
      expect(stripeCalls.filter(c => c[0] === 'refunds.create')).to.have.length(allowed.length)
    })

    it('refunds and then cancels the subscription now when asked', async () => {
      const sub = await stripeRow()
      const result = await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: sub.id })
      expect(result).to.include({ id: 're_1', subscriptionCanceled: true, cancelError: null })
      expect(stripeCalls.map(c => c[0]).filter(name => ['refunds.create', 'cancel'].includes(name))).to.deep.equal(['refunds.create', 'cancel'])
      expect((await HyloProSubscription.where({ id: sub.id }).fetch()).get('status')).to.equal('canceled')
      expect(await group.hasPro()).to.be.false
    })

    it('reports a failed cancellation after a successful refund, keeping the refund', async () => {
      const sub = await stripeRow()
      stripeMock.subscriptions.cancel = async id => {
        stripeCalls.push(['cancel', id])
        throw new Error('Stripe is down')
      }
      const result = await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: sub.id })
      expect(result).to.include({ id: 're_1', amount: 1000, subscriptionCanceled: false, cancelError: 'Stripe is down' })
      expect(stripeCalls.filter(c => c[0] === 'refunds.create')).to.have.length(1)
      expect((await HyloProSubscription.where({ id: sub.id }).fetch()).get('status')).to.equal('active')
    })

    it("refuses before refunding when the subscription to cancel has ended or isn't the group's", async () => {
      const ended = await stripeRow({ status: 'canceled', ended_at: new Date() })
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: ended.id })).to.be.rejectedWith(/already ended/)
      const other = await HyloProSubscription.forge({ group_id: otherGroup.id, source: 'stripe', status: 'active', stripe_subscription_id: 'sub_other' }).save()
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: other.id })).to.be.rejectedWith(/isn't this group's/)
      const grant = await grantRow()
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: grant.id })).to.be.rejectedWith(/not a Stripe subscription/)
      expect(stripeCalls.filter(c => ['refunds.create', 'cancel'].includes(c[0]))).to.deep.equal([])
    })

    it("refuses to cancel a subscription the refunded payment didn't pay for, before refunding", async () => {
      const sub = await stripeRow()
      // A payment for the group's earlier subscription, and one that wasn't for a subscription
      charges.push({ id: 'ch_old', customer: 'cus_1', amount: 1000, amount_refunded: 0, paid: true, payment_intent: 'pi_old' })
      charges.push({ id: 'ch_none', customer: 'cus_1', amount: 1000, amount_refunded: 0, paid: true, payment_intent: 'pi_none' })
      invoiceSubscriptions.pi_old = 'sub_old'
      for (const chargeId of ['ch_old', 'ch_none']) {
        await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId, cancelSubscriptionId: sub.id }), chargeId).to.be.rejectedWith(/isn't for that subscription/)
      }
      // When the lookup fails the link can't be confirmed, so nothing happens either
      const rawRequest = stripeMock.rawRequest
      stripeMock.rawRequest = async () => { throw new Error('Stripe is down') }
      await expect(refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_1', cancelSubscriptionId: sub.id })).to.be.rejectedWith(/isn't for that subscription/)
      stripeMock.rawRequest = rawRequest
      expect(stripeCalls.filter(c => ['refunds.create', 'cancel'].includes(c[0]))).to.deep.equal([])

      // Without cancelling, those payments can still be refunded
      expect(await refundHyloProPayment(staff.id, { groupId: group.id, chargeId: 'ch_old' })).to.include({ id: 're_1', subscriptionCanceled: false })
    })

    it('accepts a group id with leading zeros as the same group', async () => {
      const sub = await stripeRow()
      const result = await refundHyloProPayment(staff.id, { groupId: `00${group.id}`, chargeId: 'ch_1', cancelSubscriptionId: sub.id })
      expect(result).to.include({ id: 're_1', subscriptionCanceled: true })
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
        { group_id: otherGroup.id, source: 'stripe', status: 'past_due', interval: 'month', stripe_subscription_id: 'sub_grace', current_period_start: new Date(now - DAY * 1000), current_period_end: new Date(PERIOD_END * 1000) },
        { group_id: otherGroup.id, source: 'stripe', status: 'canceled', interval: 'month', stripe_subscription_id: 'sub_old', canceled_at: now, ended_at: now, current_period_end: now },
        { group_id: otherGroup.id, source: 'manual', status: 'canceled', ended_at: now }
      ])

      const metrics = await hyloProMetrics(staff.id)
      expect(metrics).to.include({
        activeGroups: 2,
        stripeGroups: 2,
        manualGroups: 1,
        // Paying only, the same rows MRR counts: sub_1 and the past_due one still in grace. Not the
        // trialing one, nor sub_pd (past its grace)
        monthlySubscriptions: 2,
        yearlySubscriptions: 1,
        trialing: 1,
        cancelling: 1,
        pastDue: 2,
        grantsExpiringSoon: 1,
        // None of these rows has a stored amount yet, so each counts at today's plan price
        mrrCents: 2 * HyloProAdminService.monthlyAmount('month') + HyloProAdminService.monthlyAmount('year'),
        currency: 'usd',
        mrrEstimatedSubscriptions: 3
      })
      expect(metrics.months).to.have.length(6)
      const thisMonth = metrics.months[5]
      expect(thisMonth.month).to.equal(now.toISOString().slice(0, 7))
      expect(thisMonth).to.include({ newSubscriptions: 6, cancellations: 2, ended: 1, grants: 2 })
      expect(metrics.months.slice(0, 5).every(m => m.newSubscriptions === 0 && m.grants === 0)).to.be.true
    })

    it('computes MRR from what each subscription pays: its own price and discount, per currency, yearly as 1/12', async () => {
      const row = (id, attrs) => ({
        group_id: otherGroup.id,
        source: 'stripe',
        status: 'active',
        interval: 'month',
        currency: 'usd',
        stripe_subscription_id: id,
        current_period_end: new Date(PERIOD_END * 1000),
        ...attrs
      })
      await bookshelf.knex('hylo_pro_subscriptions').insert([
        // An older, lower price: 4500, not today's 6000
        row('sub_old_price', { amount: 4500 }),
        // 50% off forever: 3000
        row('sub_half', { amount: 6000, discount_coupon_id: 'HALF', discount_percent_off: 50, discount_duration: 'forever' }),
        // Yearly, 120.00 off for the next months: (60000 - 12000) / 12 = 4000
        row('sub_year', { interval: 'year', amount: 60000, discount_coupon_id: 'Y120', discount_amount_off: 12000, discount_currency: 'usd', discount_duration: 'repeating', discount_ends_at: future(60) }),
        // A repeating discount that has ended, and a once-only one already used: full price, 6000 each
        row('sub_ended_discount', { amount: 6000, discount_coupon_id: 'OLD', discount_percent_off: 20, discount_duration: 'repeating', discount_ends_at: future(-1) }),
        row('sub_once', { amount: 6000, discount_coupon_id: 'FIRST', discount_percent_off: 25, discount_duration: 'once' }),
        // Not synced with an amount yet: today's monthly plan price, flagged as an estimate
        row('sub_unsynced', {}),
        // Another currency, billed every 3 months: 4000 / 3 = 1333.33, kept apart from USD
        row('sub_eur', { currency: 'eur', amount: 4000, interval_count: 3 }),
        // Not counted: trialing, and ended
        row('sub_trial', { status: 'trialing', amount: 6000 }),
        row('sub_gone', { status: 'canceled', amount: 6000, ended_at: new Date(), current_period_end: new Date() })
      ])

      const metrics = await hyloProMetrics(staff.id)
      const usd = 4500 + 3000 + 4000 + 6000 + 6000 + HyloProAdminService.monthlyAmount('month')
      expect(metrics).to.include({ mrrCents: usd, currency: 'usd', mrrEstimatedSubscriptions: 1, monthlySubscriptions: 6, yearlySubscriptions: 1 })
      expect(metrics.mrrByCurrency).to.deep.equal([
        { currency: 'usd', mrrCents: usd, subscriptions: 6 },
        { currency: 'eur', mrrCents: 1333, subscriptions: 1 }
      ])
    })

    it('monthlyRevenue ignores an amount-off discount in another currency and never goes below zero', () => {
      const base = { source: 'stripe', interval: 'month', amount: 6000, currency: 'usd', discount_coupon_id: 'X', discount_duration: 'forever' }
      expect(HyloProAdminService.monthlyRevenue({ ...base, discount_amount_off: 1000, discount_currency: 'eur' }).cents).to.equal(6000)
      expect(HyloProAdminService.monthlyRevenue({ ...base, discount_amount_off: 9000, discount_currency: 'usd' }).cents).to.equal(0)
      expect(HyloProAdminService.monthlyRevenue({ ...base, interval: 'week', amount: 1200 }).cents).to.equal(5200)
      // numeric columns come back from Postgres as strings
      expect(HyloProAdminService.monthlyRevenue({ ...base, discount_percent_off: '12.5000' }).cents).to.equal(5250)
    })

    it("shows each subscription's stored price, discount and monthly revenue", async () => {
      await stripeRow({ interval: 'year', amount: 60000, currency: 'usd', interval_count: 1, discount_coupon_id: 'TENOFF', discount_percent_off: 10, discount_duration: 'repeating', discount_ends_at: future(30) })
      await grantRow()
      const { items } = await hyloProSubscriptions(staff.id, {})
      const sub = items.find(i => i.source === 'stripe')
      expect(sub).to.include({ amount: 60000, currency: 'usd', intervalCount: 1, monthlyRevenueCents: 4500 })
      expect(sub.discount).to.include({ couponId: 'TENOFF', percentOff: 10, amountOff: null, duration: 'repeating' })
      const grant = items.find(i => i.source === 'manual')
      expect(grant).to.include({ amount: null, discount: null, monthlyRevenueCents: null })
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
  describe('recorded refunds and disputes', () => {
    async function log (attrs) {
      const now = new Date()
      await bookshelf.knex('stripe_logs').insert({ group_id: group.id, currency: 'usd', created_at: now, updated_at: now, ...attrs })
    }

    beforeEach(async () => {
      await log({ log_type: HyloProService.LOG_TYPE_REFUND, external_id: 'ch_r', charge_id: 'ch_r', amount: 2000, status: 'partially_refunded', reason: 'requested_by_customer', updated_at: new Date(Date.now() - 2000) })
      await log({ log_type: HyloProService.LOG_TYPE_DISPUTE, external_id: 'dp_open', charge_id: 'ch_d', amount: 6000, status: 'needs_response', reason: 'fraudulent', updated_at: new Date(Date.now() - 1000) })
      await log({ log_type: HyloProService.LOG_TYPE_DISPUTE, external_id: 'dp_won', charge_id: 'ch_w', amount: 6000, status: 'won', reason: 'product_not_received', updated_at: new Date(Date.now() - 3000) })
      // Not Pro: a Connect refund for the same group, and another group's Pro refund
      await log({ log_type: 'refund', external_id: 'ch_connect', charge_id: 'ch_connect', amount: 500, status: 'refunded' })
      await log({ group_id: otherGroup.id, log_type: HyloProService.LOG_TYPE_REFUND, external_id: 'ch_other', charge_id: 'ch_other', amount: 6000, status: 'refunded' })
    })

    it("lists a group's Pro refunds and disputes, most recently updated first, marking open disputes", async () => {
      const events = await hyloProChargeEvents(staff.id, { groupId: group.id })
      expect(events.map(e => [e.type, e.externalId, e.status, e.open])).to.deep.equal([
        ['dispute', 'dp_open', 'needs_response', true],
        ['refund', 'ch_r', 'partially_refunded', false],
        ['dispute', 'dp_won', 'won', false]
      ])
      expect(events[0]).to.include({ chargeId: 'ch_d', amount: 6000, currency: 'usd', reason: 'fraudulent' })
      expect(stripeCalls).to.deep.equal([])
    })

    it("counts open disputes and refunds on the group's Stripe rows, not on grants", async () => {
      await stripeRow()
      await grantRow()
      const { items } = await hyloProSubscriptions(staff.id, { filter: 'all' })
      expect(items.find(i => i.source === 'stripe')).to.include({ openDisputes: 1, refunds: 1 })
      expect(items.find(i => i.source === 'manual')).to.include({ openDisputes: 0, refunds: 0 })

      // A single row (as mutations return it) gets the same counts
      const sub = await HyloProSubscription.where({ group_id: group.id, source: 'stripe' }).fetch()
      const cancelled = await cancelHyloProSubscription(staff.id, { id: sub.id })
      expect(cancelled).to.include({ openDisputes: 1, refunds: 1 })
    })

    it('counts per group, and nothing for no groups', async () => {
      const counts = await HyloProAdminService.chargeEventCounts([otherGroup.id, group.id])
      expect(counts.get(String(otherGroup.id))).to.deep.equal({ openDisputes: 0, refunds: 1 })
      expect(await hyloProChargeEvents(staff.id, { groupId: otherGroup.id })).to.have.length(1)
      expect((await HyloProAdminService.chargeEventCounts([])).size).to.equal(0)
    })
  })
})
