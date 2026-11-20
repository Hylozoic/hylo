/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import nock from 'nock'
import setup from '../../setup'
import factories from '../../setup/factories'
import OpenCollectiveService from '../../../api/services/OpenCollectiveService'
import SupporterService from '../../../api/services/SupporterService'
import { orderQualifies, userIsSupporter, groupIsSupporter } from '../../../lib/supporters/status'
import { createRequestHandler } from '../../../api/graphql'

// Never call the live Open Collective API: every request goes through nock.
const OC_HOST = 'https://api.opencollective.com'
const OC_PATH = '/graphql/v2'
const TOKEN = 'test-oc-token'
const DAY = 24 * 60 * 60 * 1000

const daysAgo = n => new Date(Date.now() - n * DAY).toISOString()

let orderSeq = 0
function ocOrder (attrs = {}) {
  orderSeq++
  return {
    id: `order-${orderSeq}`,
    status: 'PAID',
    frequency: 'ONETIME',
    createdAt: daysAgo(10),
    lastChargedAt: null,
    nextChargeDate: null,
    tags: [],
    amount: { valueInCents: 2500, currency: 'USD' },
    fromAccount: { id: 'acct-1', slug: 'alice', type: 'INDIVIDUAL', isIncognito: false, isGuest: false },
    toAccount: { slug: 'hylo' },
    ...attrs
  }
}

// Replies to OC GraphQL calls by operation name, and records each call
function mockOC (handlers) {
  const calls = []
  nock(OC_HOST)
    .persist()
    .post(OC_PATH)
    .reply(function (uri, body) {
      calls.push({ body, token: [].concat(this.req.headers['personal-token'])[0] })
      const name = Object.keys(handlers).find(n => body.query.includes(n))
      if (!name) return [500, { errors: [{ message: `unexpected query ${body.query}` }] }]
      return [200, handlers[name](body.variables)]
    })
  return calls
}

const incomingOrders = nodes => () => ({ data: { account: { orders: { totalCount: nodes.length, nodes } } } })
const members = accounts => () => ({ data: { account: { members: { nodes: accounts.map(account => ({ account })) } } } })
const singleOrder = node => () => node ? { data: { order: node } } : { data: null, errors: [{ message: 'Order Not Found' }] }

async function insertOrder (attrs) {
  const [row] = await bookshelf.knex('open_collective_orders').insert({
    oc_order_id: `local-${++orderSeq}`,
    oc_account_id: 'acct-1',
    status: 'PAID',
    frequency: 'ONETIME',
    oc_created_at: daysAgo(10),
    tags: [],
    ...attrs
  }).returning('*')
  return row
}

const codeOf = async promise => {
  try {
    await promise
  } catch (e) {
    return (e.extensions && e.extensions.code) || e.message
  }
  return 'no error'
}

describe('Hylo supporters (Open Collective)', () => {
  let originalEnv

  before(() => {
    nock.disableNetConnect()
    return setup.clearDb()
  })

  after(() => {
    nock.enableNetConnect()
    return setup.clearDb()
  })

  beforeEach(async () => {
    originalEnv = {
      token: process.env.OPEN_COLLECTIVE_TOKEN,
      slug: process.env.OPEN_COLLECTIVE_SLUG,
      url: process.env.OPEN_COLLECTIVE_API_URL,
      admins: process.env.HYLO_ADMINS
    }
    process.env.OPEN_COLLECTIVE_TOKEN = TOKEN
    process.env.OPEN_COLLECTIVE_SLUG = 'hylo'
    delete process.env.OPEN_COLLECTIVE_API_URL
    OpenCollectiveService.resetSyncState()
    await bookshelf.knex('support_intents').del()
    await bookshelf.knex('supporter_grants').del()
    await bookshelf.knex('supporter_links').del()
    await bookshelf.knex('open_collective_orders').del()
  })

  afterEach(() => {
    const restore = (key, value) => { if (value === undefined) delete process.env[key]; else process.env[key] = value }
    restore('OPEN_COLLECTIVE_TOKEN', originalEnv.token)
    restore('OPEN_COLLECTIVE_SLUG', originalEnv.slug)
    restore('OPEN_COLLECTIVE_API_URL', originalEnv.url)
    restore('HYLO_ADMINS', originalEnv.admins)
    nock.cleanAll()
  })

  describe('status rules', () => {
    const now = new Date()
    it('counts a recurring contribution only while it is ACTIVE', () => {
      expect(orderQualifies({ frequency: 'MONTHLY', status: 'ACTIVE' }, now)).to.be.true
      expect(orderQualifies({ frequency: 'YEARLY', status: 'ACTIVE' }, now)).to.be.true
      expect(orderQualifies({ frequency: 'MONTHLY', status: 'CANCELLED', last_charged_at: daysAgo(3) }, now)).to.be.false
      expect(orderQualifies({ frequency: 'MONTHLY', status: 'PAUSED' }, now)).to.be.false
    })

    it('counts a one-time contribution for 12 months', () => {
      expect(orderQualifies({ frequency: 'ONETIME', status: 'PAID', oc_created_at: daysAgo(300) }, now)).to.be.true
      expect(orderQualifies({ frequency: 'ONETIME', status: 'PAID', oc_created_at: daysAgo(400) }, now)).to.be.false
      expect(orderQualifies({ frequency: 'ONETIME', status: 'PAID', oc_created_at: daysAgo(400), last_charged_at: daysAgo(20) }, now)).to.be.true
    })

    it('never counts refunded, disputed or unpaid contributions', () => {
      for (const status of ['REFUNDED', 'DISPUTED', 'PENDING', 'ERROR', 'REJECTED']) {
        expect(orderQualifies({ frequency: 'ONETIME', status, oc_created_at: daysAgo(1) }, now), status).to.be.false
        expect(orderQualifies({ frequency: 'MONTHLY', status }, now), status).to.be.false
      }
    })

    it('applies the same rules in SQL for linked users', async () => {
      const user = await factories.user().save()
      await bookshelf.knex('supporter_links').insert({ user_id: user.id, oc_account_id: 'acct-1', method: 'email' })
      expect(await userIsSupporter(user.id)).to.be.false

      const old = await insertOrder({ frequency: 'ONETIME', status: 'PAID', oc_created_at: daysAgo(400) })
      await insertOrder({ frequency: 'ONETIME', status: 'REFUNDED', oc_created_at: daysAgo(5) })
      await insertOrder({ frequency: 'MONTHLY', status: 'CANCELLED', oc_created_at: daysAgo(30) })
      expect(await userIsSupporter(user.id)).to.be.false

      await bookshelf.knex('open_collective_orders').where({ id: old.id }).update({ oc_created_at: daysAgo(100) })
      expect(await userIsSupporter(user.id)).to.be.true

      await bookshelf.knex('open_collective_orders').del()
      await insertOrder({ frequency: 'MONTHLY', status: 'ACTIVE', oc_created_at: daysAgo(900) })
      expect(await userIsSupporter(user.id)).to.be.true
    })

    it('ignores contributions from accounts that are not linked', async () => {
      const user = await factories.user().save()
      await insertOrder({ oc_account_id: 'someone-else', frequency: 'MONTHLY', status: 'ACTIVE' })
      expect(await userIsSupporter(user.id)).to.be.false
    })

    it('counts a manual grant until it expires or is revoked', async () => {
      const user = await factories.user().save()
      const [grant] = await bookshelf.knex('supporter_grants').insert({ user_id: user.id }).returning('*')
      expect(await userIsSupporter(user.id)).to.be.true

      await bookshelf.knex('supporter_grants').where({ id: grant.id }).update({ expires_at: daysAgo(-5) })
      expect(await userIsSupporter(user.id)).to.be.true
      await bookshelf.knex('supporter_grants').where({ id: grant.id }).update({ expires_at: daysAgo(1) })
      expect(await userIsSupporter(user.id)).to.be.false

      await bookshelf.knex('supporter_grants').where({ id: grant.id }).update({ expires_at: null, revoked_at: new Date() })
      expect(await userIsSupporter(user.id)).to.be.false
    })

    it('counts a group only for contributions attributed by the linked owner, or a grant', async () => {
      const user = await factories.user().save()
      const group = await factories.group().save()
      await insertOrder({ frequency: 'MONTHLY', status: 'ACTIVE', attributed_group_id: group.id, attributed_by_id: user.id })
      expect(await groupIsSupporter(group.id)).to.be.false // not linked to the attributing user

      await bookshelf.knex('supporter_links').insert({ user_id: user.id, oc_account_id: 'acct-1', method: 'email' })
      expect(await groupIsSupporter(group.id)).to.be.true

      const other = await factories.group().save()
      expect(await groupIsSupporter(other.id)).to.be.false
      await bookshelf.knex('supporter_grants').insert({ group_id: other.id })
      expect(await groupIsSupporter(other.id)).to.be.true
    })
  })

  describe('OpenCollectiveService', () => {
    it('no-ops the sync with a log line when the token is not set', async () => {
      delete process.env.OPEN_COLLECTIVE_TOKEN
      const calls = mockOC({})
      const result = await OpenCollectiveService.syncOrders()
      expect(result).to.deep.equal({ skipped: true, count: 0 })
      expect(calls).to.have.length(0)
    })

    it('pages through incoming orders with the Personal-Token header and upserts idempotently', async () => {
      const nodes = Array.from({ length: 150 }, () => ocOrder())
      const calls = mockOC({
        HyloIncomingOrders: ({ offset, limit }) => ({ data: { account: { orders: { totalCount: nodes.length, nodes: nodes.slice(offset, offset + limit) } } } })
      })

      const first = await OpenCollectiveService.syncOrders()
      expect(first.count).to.equal(150)
      expect(calls).to.have.length(2)
      expect(calls.every(c => c.token === TOKEN)).to.be.true
      expect(calls.map(c => c.body.variables.offset)).to.deep.equal([0, 100])

      // Hylo-side attribution survives a re-sync, OC fields are updated
      const group = await factories.group().save()
      await bookshelf.knex('open_collective_orders').where({ oc_order_id: nodes[0].id }).update({ attributed_group_id: group.id })
      nodes[0].status = 'REFUNDED'
      OpenCollectiveService.resetSyncState()
      await OpenCollectiveService.syncOrders()

      const rows = await bookshelf.knex('open_collective_orders')
      expect(rows).to.have.length(150)
      const row = rows.find(r => r.oc_order_id === nodes[0].id)
      expect(row.status).to.equal('REFUNDED')
      expect(String(row.attributed_group_id)).to.equal(String(group.id))
      // OC-only details such as the amount stay in the raw payload
      expect(row.raw.amount.valueInCents).to.equal(2500)
    })

    it('ignores orders to other collectives', async () => {
      mockOC({ HyloIncomingOrders: incomingOrders([ocOrder(), ocOrder({ toAccount: { slug: 'not-hylo' } })]) })
      await OpenCollectiveService.syncOrders()
      expect(await bookshelf.knex('open_collective_orders').count('id as n').first()).to.deep.equal({ n: '1' })
    })

    it('returns null for an unknown order', async () => {
      mockOC({ HyloOrder: singleOrder(null) })
      expect(await OpenCollectiveService.fetchOrder('nope')).to.be.null
    })
  })

  describe('claimByEmail', () => {
    it('says the check is not available without a token', async () => {
      delete process.env.OPEN_COLLECTIVE_TOKEN
      const user = await factories.user({ email_validated: true }).save()
      expect(await codeOf(SupporterService.claimByEmail(user.id))).to.equal('OPEN_COLLECTIVE_NOT_CONFIGURED')
    })

    it('requires a verified email', async () => {
      const user = await factories.user({ email_validated: false }).save()
      const calls = mockOC({})
      expect(await codeOf(SupporterService.claimByEmail(user.id))).to.equal('EMAIL_NOT_VERIFIED')
      expect(calls).to.have.length(0)
    })

    it('checks only the verified email and links the accounts found', async () => {
      const user = await factories.user({ email_validated: true }).save()
      const calls = mockOC({
        HyloMembersByEmail: members([{ id: 'acct-1', slug: 'alice', isIncognito: false }]),
        HyloIncomingOrders: incomingOrders([ocOrder({ frequency: 'MONTHLY', status: 'ACTIVE' })])
      })

      const result = await SupporterService.claimByEmail(user.id)
      expect(result).to.include({ found: true, linkedCount: 1, supporterStatus: 'supporter' })
      const membersCall = calls.find(c => c.body.query.includes('HyloMembersByEmail'))
      expect(membersCall.body.variables).to.deep.equal({ slug: 'hylo', email: user.get('email') })

      // Linking alone shows nothing publicly: the badge is opt-in
      const fresh = await User.find(user.id)
      expect(await SupporterService.isUserBadgeVisible(fresh)).to.be.false
    })

    it('reports no match and links nothing when OC has no contributor with that email', async () => {
      const user = await factories.user({ email_validated: true }).save()
      mockOC({ HyloMembersByEmail: members([]) })
      expect(await SupporterService.claimByEmail(user.id)).to.include({ found: false, linkedCount: 0, supporterStatus: 'none' })
    })

    it('does not move an account already linked to someone else', async () => {
      const owner = await factories.user().save()
      const user = await factories.user({ email_validated: true }).save()
      await bookshelf.knex('supporter_links').insert({ user_id: owner.id, oc_account_id: 'acct-1', method: 'email' })
      mockOC({ HyloMembersByEmail: members([{ id: 'acct-1', slug: 'alice' }]) })
      expect(await SupporterService.claimByEmail(user.id)).to.include({ found: true, linkedCount: 0, linkedElsewhere: true })
      const link = await SupporterLink.where({ oc_account_id: 'acct-1' }).fetch()
      expect(String(link.get('user_id'))).to.equal(String(owner.id))
    })
  })

  describe('donation intents', () => {
    let user, other, group

    beforeEach(async () => {
      user = await factories.user({ email_validated: true }).save()
      other = await factories.user().save()
      group = await factories.group().save()
      await user.joinGroup(group, { assignAdministrator: true })
      await other.joinGroup(group)
    })

    it('only lets group admins attribute a donation to a group', async () => {
      expect(await codeOf(SupporterService.createIntent(other.id, group.id))).to.equal('NOT_GROUP_ADMIN')
      const intent = await SupporterService.createIntent(user.id, group.id)
      expect(intent.token).to.match(/^[0-9a-f]{32}$/)
      expect(intent.tag).to.equal(`hylo-${intent.token}`)
    })

    it('confirms a paid order carrying this user\'s tag and attributes it to the group', async () => {
      const { tag } = await SupporterService.createIntent(user.id, group.id)
      const node = ocOrder({ frequency: 'MONTHLY', status: 'ACTIVE', tags: [tag], fromAccount: { id: 'acct-9', slug: 'incog', type: 'INDIVIDUAL', isIncognito: true } })
      mockOC({ HyloOrder: singleOrder(node) })

      const result = await SupporterService.confirmIntent(user.id, node.id)
      expect(result).to.include({ outcome: 'confirmed', supporterStatus: 'supporter' })
      expect(String(result.groupId)).to.equal(String(group.id))
      expect(await groupIsSupporter(group.id)).to.be.true

      // Confirming again is harmless
      expect((await SupporterService.confirmIntent(user.id, node.id)).outcome).to.equal('confirmed')
    })

    it('rejects an order made to another collective', async () => {
      const { tag } = await SupporterService.createIntent(user.id)
      const node = ocOrder({ tags: [tag], toAccount: { slug: 'someone-else' } })
      mockOC({ HyloOrder: singleOrder(node) })
      expect(await codeOf(SupporterService.confirmIntent(user.id, node.id))).to.equal('SUPPORT_WRONG_COLLECTIVE')
    })

    it("rejects another user's token", async () => {
      const { tag } = await SupporterService.createIntent(other.id)
      const node = ocOrder({ tags: [tag] })
      mockOC({ HyloOrder: singleOrder(node) })
      expect(await codeOf(SupporterService.confirmIntent(user.id, node.id))).to.equal('SUPPORT_INTENT_MISMATCH')
      expect(await SupporterLink.where({ oc_account_id: 'acct-1' }).fetch()).to.be.null
    })

    it('does not count an unpaid order', async () => {
      const { tag } = await SupporterService.createIntent(user.id)
      const failed = ocOrder({ tags: [tag], status: 'ERROR' })
      const pending = ocOrder({ tags: [tag], status: 'PENDING' })
      mockOC({ HyloOrder: ({ id }) => singleOrder([failed, pending].find(o => o.id === id))() })

      expect(await codeOf(SupporterService.confirmIntent(user.id, failed.id))).to.equal('SUPPORT_ORDER_NOT_PAID')
      expect(await SupporterService.confirmIntent(user.id, pending.id)).to.include({ outcome: 'pending', supporterStatus: 'none' })
      expect(await SupporterLink.where({ oc_account_id: 'acct-1' }).fetch()).to.be.null
    })

    it('reports an order OC does not know', async () => {
      mockOC({ HyloOrder: singleOrder(null) })
      expect(await codeOf(SupporterService.confirmIntent(user.id, 'missing'))).to.equal('SUPPORT_ORDER_NOT_FOUND')
    })

    it('falls back to the email check when the tag was lost', async () => {
      const node = ocOrder({ tags: [] })
      mockOC({
        HyloOrder: singleOrder(node),
        HyloMembersByEmail: members([{ id: 'acct-1', slug: 'alice' }]),
        HyloIncomingOrders: incomingOrders([node])
      })
      expect(await SupporterService.confirmIntent(user.id, node.id)).to.deep.equal({ outcome: 'email_match', supporterStatus: 'supporter', groupId: null })
    })

    it('finishes intents during a sync when the user never came back', async () => {
      const { tag } = await SupporterService.createIntent(user.id, group.id)
      mockOC({ HyloIncomingOrders: incomingOrders([ocOrder({ tags: [tag] })]) })
      await OpenCollectiveService.syncOrders()
      expect(await SupporterService.userStatus(user.id)).to.equal('supporter')
      expect(await SupporterService.groupStatus(group.id)).to.equal('supporter')
    })

    it('lets the owner move a contribution to another group they administer, or none', async () => {
      await bookshelf.knex('supporter_links').insert({ user_id: user.id, oc_account_id: 'acct-1', method: 'email' })
      const order = await insertOrder({ frequency: 'MONTHLY', status: 'ACTIVE' })

      expect(await codeOf(SupporterService.attributeContribution(other.id, order.id, group.id))).to.equal('SUPPORT_CONTRIBUTION_NOT_FOUND')
      const notAdminGroup = await factories.group().save()
      await user.joinGroup(notAdminGroup)
      expect(await codeOf(SupporterService.attributeContribution(user.id, order.id, notAdminGroup.id))).to.equal('NOT_GROUP_ADMIN')

      await SupporterService.attributeContribution(user.id, order.id, group.id)
      expect(await groupIsSupporter(group.id)).to.be.true
      await SupporterService.attributeContribution(user.id, order.id, null)
      expect(await groupIsSupporter(group.id)).to.be.false
    })
  })

  describe('badge visibility', () => {
    it('is off by default and switching it off hides the badge immediately', async () => {
      const user = await factories.user().save()
      await bookshelf.knex('supporter_grants').insert({ user_id: user.id })
      expect(await SupporterService.isUserBadgeVisible(await User.find(user.id))).to.be.false

      await SupporterService.setBadgeVisibility(user.id, { show: true })
      expect(await SupporterService.isUserBadgeVisible(await User.find(user.id))).to.be.true

      await SupporterService.setBadgeVisibility(user.id, { show: false })
      expect(await SupporterService.isUserBadgeVisible(await User.find(user.id))).to.be.false
    })

    it('only lets group admins change a group badge', async () => {
      const admin = await factories.user().save()
      const member = await factories.user().save()
      const group = await factories.group().save()
      await admin.joinGroup(group, { assignAdministrator: true })
      await member.joinGroup(group)
      await bookshelf.knex('supporter_grants').insert({ group_id: group.id })

      expect(await codeOf(SupporterService.setBadgeVisibility(member.id, { groupId: group.id, show: true }))).to.equal('NOT_GROUP_ADMIN')
      expect(await codeOf(SupporterService.groupSupportInfo(member.id, group.id))).to.equal('NOT_GROUP_ADMIN')
      await SupporterService.setBadgeVisibility(admin.id, { groupId: group.id, show: true })
      expect(await SupporterService.isGroupBadgeVisible(await Group.find(group.id))).to.be.true
      expect(await SupporterService.groupSupportInfo(admin.id, group.id)).to.deep.equal({ supporterStatus: 'supporter', showSupporterBadge: true })
    })
  })

  describe('staff grants', () => {
    let staff, user, group

    beforeEach(async () => {
      staff = await factories.user().save()
      user = await factories.user().save()
      group = await factories.group().save()
      process.env.HYLO_ADMINS = String(staff.id)
    })

    it('are only for Hylo admins', async () => {
      expect(await codeOf(SupporterService.grant(user.id, { userId: user.id }))).to.match(/Admin access/)
      expect(await codeOf(SupporterService.listGrants(user.id))).to.match(/Admin access/)
      const grant = await SupporterService.grant(staff.id, { userId: user.id })
      expect(await codeOf(SupporterService.revoke(user.id, grant.id))).to.match(/Admin access/)
    })

    it('grant, list and revoke supporter status for a person, recording who granted it', async () => {
      const expiresAt = new Date(Date.now() + 30 * DAY)
      const grant = await SupporterService.grant(staff.id, { userId: user.id, note: '  Translated the app  ', expiresAt })
      expect(grant.get('note')).to.equal('Translated the app')
      expect(String(grant.get('granted_by_id'))).to.equal(String(staff.id))
      expect(await SupporterService.userStatus(user.id)).to.equal('supporter')

      // Granting again updates the active grant instead of adding another
      await SupporterService.grant(staff.id, { userId: user.id, note: 'Updated' })
      const grants = await SupporterService.listGrants(staff.id)
      expect(grants.map(g => g.id)).to.deep.equal([grant.id])

      await SupporterService.revoke(staff.id, grant.id)
      expect(await SupporterService.userStatus(user.id)).to.equal('none')
      expect(await SupporterService.listGrants(staff.id)).to.have.length(0)
      const revoked = await SupporterGrant.where({ id: grant.id }).fetch()
      expect(String(revoked.get('revoked_by_id'))).to.equal(String(staff.id))
    })

    it('grants a group', async () => {
      await SupporterService.grant(staff.id, { groupId: group.id })
      expect(await SupporterService.groupStatus(group.id)).to.equal('supporter')
    })

    it('validates the target and expiry', async () => {
      expect(await codeOf(SupporterService.grant(staff.id, {}))).to.match(/either a person or a group/)
      expect(await codeOf(SupporterService.grant(staff.id, { userId: user.id, groupId: group.id }))).to.match(/either a person or a group/)
      expect(await codeOf(SupporterService.grant(staff.id, { userId: user.id, expiresAt: daysAgo(1) }))).to.match(/future/)
    })
  })
  describe('through GraphQL', () => {
    let user, group, viewer

    async function run (document, sessionUserId) {
      const req = factories.mock.request()
      Object.assign(req, { url: '/noo/graphql', method: 'POST', headers: { 'Content-Type': 'application/json' } })
      req.session = { userId: sessionUserId, destroy: () => {} }
      const { executionResult } = await createRequestHandler().inject({ document, serverContext: { req, res: factories.mock.response() } })
      return executionResult
    }

    beforeEach(async () => {
      user = await factories.user({ email_validated: true }).save()
      viewer = await factories.user().save()
      group = await factories.group().save()
      await user.joinGroup(group, { assignAdministrator: true })
      await viewer.joinGroup(group)
      await bookshelf.knex('supporter_links').insert({ user_id: user.id, oc_account_id: 'acct-1', method: 'email' })
      await insertOrder({ frequency: 'MONTHLY', status: 'ACTIVE', attributed_group_id: group.id, attributed_by_id: user.id })
    })

    it('exposes booleans and dates only, and the badge only once opted in', async () => {
      const personQuery = `{ person(id: "${user.id}") { isSupporter } group(id: "${group.id}") { isSupporter } }`
      let result = await run(personQuery, viewer.id)
      expect(result.errors).to.be.undefined
      expect(result.data).to.deep.equal({ person: { isSupporter: false }, group: { isSupporter: false } })

      await run(`mutation { setSupporterBadgeVisibility(show: true) }`, user.id)
      await run(`mutation { setSupporterBadgeVisibility(groupId: "${group.id}", show: true) }`, user.id)
      result = await run(personQuery, viewer.id)
      expect(result.data).to.deep.equal({ person: { isSupporter: true }, group: { isSupporter: true } })

      result = await run(`{ supportHylo {
        checkAvailable supporterStatus showSupporterBadge manualGrant
        contributions { frequency status isIncognito qualifies group { id } }
        adminGroups { id }
      } }`, user.id)
      expect(result.errors).to.be.undefined
      expect(result.data.supportHylo).to.deep.equal({
        checkAvailable: true,
        supporterStatus: 'supporter',
        showSupporterBadge: true,
        manualGrant: false,
        contributions: [{ frequency: 'MONTHLY', status: 'ACTIVE', isIncognito: false, qualifies: true, group: { id: String(group.id) } }],
        adminGroups: [{ id: String(group.id) }]
      })

      // There is no amount field to ask for
      result = await run('{ supportHylo { contributions { amount } } }', user.id)
      expect(result.errors[0].message).to.match(/Cannot query field "amount"/)
    })

    it('keeps admin queries for Hylo staff', async () => {
      const result = await run('{ supporterGrants { id } }', viewer.id)
      expect(result.errors[0].message).to.match(/Admin access/)
    })
  })
})
