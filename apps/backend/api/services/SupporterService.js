/**
 * SupporterService
 *
 * Hylo supporter badges (#1754): linking Open Collective contributions to Hylo
 * users, attributing them to a group, the in-app donation flow, display
 * opt-ins and manual grants from Hylo staff.
 *
 * Privacy: GraphQL only ever sees booleans and dates from here, never amounts.
 * Linking a contribution shows nothing publicly; badges are opt-in.
 */
const crypto = require('crypto')
const { GraphQLError } = require('graphql')
const OpenCollectiveService = require('./OpenCollectiveService')
const status = require('../../lib/supporters/status')

const PAID_STATUSES = ['PAID', 'ACTIVE']
// Orders that may still become paid (bank transfers wait for the host, etc.)
const PENDING_STATUSES = ['NEW', 'PENDING', 'PROCESSING', 'REQUIRE_CLIENT_CONFIRMATION', 'IN_REVIEW']
const ON_DEMAND_SYNC_INTERVAL_MS = 60 * 1000
const BADGE_SETTING = 'show_supporter_badge'

function supportError (message, code, extra = {}) {
  return new GraphQLError(message, { extensions: { code, ...extra } })
}

function assertConfigured () {
  if (!OpenCollectiveService.isConfigured()) {
    throw supportError('Checking Open Collective contributions is not available yet', 'OPEN_COLLECTIVE_NOT_CONFIGURED')
  }
}

function isGroupAdmin (userId, groupId) {
  if (!userId || !groupId) return Promise.resolve(false)
  return GroupMembership.hasResponsibility(userId, groupId, Responsibility.constants.RESP_ADMINISTRATION)
}

async function assertGroupAdmin (userId, groupId) {
  if (!(await isGroupAdmin(userId, groupId))) {
    throw supportError("You don't have permission to do this for this group", 'NOT_GROUP_ADMIN')
  }
}

async function assertStaff (userId) {
  if (!(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }
}

const SupporterService = {
  PAID_STATUSES,
  PENDING_STATUSES,

  async userStatus (userId, now = new Date()) {
    return (await status.userIsSupporter(userId, now)) ? status.SUPPORTER : status.NONE
  },

  async groupStatus (groupId, now = new Date()) {
    return (await status.groupIsSupporter(groupId, now)) ? status.SUPPORTER : status.NONE
  },

  // What the badge shows publicly: opted in AND currently a supporter.
  async isUserBadgeVisible (user) {
    if (!user || user.getSetting(BADGE_SETTING) !== true) return false
    return status.userIsSupporter(user.id)
  },

  async isGroupBadgeVisible (group) {
    if (!group || group.getSetting(BADGE_SETTING) !== true) return false
    return status.groupIsSupporter(group.id)
  },

  /**
   * Links an OC account to a user. One OC account belongs to one user: returns
   * null when the account is already linked to someone else.
   */
  async linkAccount (userId, account, method) {
    if (!account || !account.id) return null
    await bookshelf.knex('supporter_links')
      .insert({ user_id: userId, oc_account_id: account.id, oc_account_slug: account.slug || null, method })
      .onConflict('oc_account_id')
      .ignore()
    const link = await SupporterLink.where({ oc_account_id: account.id }).fetch()
    return link && String(link.get('user_id')) === String(userId) ? link : null
  },

  /**
   * "Check my Open Collective contributions": looks up the user's verified
   * email on the collective (members(email:)) and links what it finds.
   * Never matches on names, and never runs without the user asking.
   */
  async claimByEmail (userId) {
    assertConfigured()
    const user = await User.find(userId)
    if (!user || !user.get('email') || !user.get('email_validated')) {
      throw supportError('Verify your email address first, then check again', 'EMAIL_NOT_VERIFIED')
    }

    const accounts = await OpenCollectiveService.findBackerAccounts(user.get('email'))
    let linkedCount = 0
    let linkedElsewhere = false
    for (const account of accounts) {
      const link = await SupporterService.linkAccount(userId, account, SupporterLink.Method.EMAIL)
      if (link) linkedCount++
      else linkedElsewhere = true
    }
    if (linkedCount > 0) {
      await OpenCollectiveService.syncOrders({ minIntervalMs: ON_DEMAND_SYNC_INTERVAL_MS })
    }

    return {
      found: accounts.length > 0,
      linkedCount,
      linkedElsewhere,
      supporterStatus: await SupporterService.userStatus(userId)
    }
  },

  /** Starts a donation: an opaque token we send to OC as the `hylo-<token>` tag. */
  async createIntent (userId, groupId) {
    if (groupId) await assertGroupAdmin(userId, groupId)
    const token = crypto.randomBytes(16).toString('hex')
    await SupportIntent.forge({ token, user_id: userId, group_id: groupId || null }).save()
    return { token, tag: SupportIntent.tagFor(token) }
  },

  /**
   * Links the order's account to the intent's user and attributes the order to
   * the intent's group (if the user is still an admin of it).
   */
  async completeIntent (intent, row) {
    const userId = intent.get('user_id')
    const link = await SupporterService.linkAccount(userId, { id: row.oc_account_id, slug: row.oc_account_slug }, SupporterLink.Method.INTENT)
    if (!link) {
      throw supportError('This Open Collective account is already linked to another Hylo account', 'SUPPORT_ACCOUNT_LINKED_ELSEWHERE')
    }

    const groupId = intent.get('group_id')
    let attributedGroupId = null
    if (groupId && await isGroupAdmin(userId, groupId)) {
      attributedGroupId = groupId
      await bookshelf.knex('open_collective_orders')
        .where({ oc_order_id: row.oc_order_id })
        .update({ attributed_group_id: groupId, attributed_by_id: userId, updated_at: new Date() })
    }

    await intent.save({ completed_at: new Date(), oc_order_id: row.oc_order_id }, { patch: true })
    return attributedGroupId
  },

  /**
   * Called on the /support/thanks return page with the order id OC put in the
   * redirect. The id comes from the browser, so the order is re-fetched from
   * OC and checked: right collective, a tag from one of this user's intents,
   * and paid. Without a hylo tag (OC may drop it) we fall back to the email check.
   */
  async confirmIntent (userId, ocOrderId) {
    assertConfigured()
    const result = await OpenCollectiveService.syncOrder(ocOrderId)
    if (!result) throw supportError("We couldn't find that contribution on Open Collective", 'SUPPORT_ORDER_NOT_FOUND')

    const { row, node } = result
    const { slug } = OpenCollectiveService.config()
    if (!node.toAccount || node.toAccount.slug !== slug || !row) {
      throw supportError('That contribution was not made to Hylo', 'SUPPORT_WRONG_COLLECTIVE')
    }

    const token = SupportIntent.tokenFromTags(node.tags)
    if (!token) {
      let found = false
      try {
        found = (await SupporterService.claimByEmail(userId)).found
      } catch (e) {
        if (!e.extensions || e.extensions.code !== 'EMAIL_NOT_VERIFIED') throw e
      }
      return { outcome: found ? 'email_match' : 'unmatched', supporterStatus: await SupporterService.userStatus(userId), groupId: null }
    }

    const intent = await SupportIntent.findByToken(token)
    if (!intent) throw supportError("We couldn't match that contribution to Hylo", 'SUPPORT_INTENT_NOT_FOUND')
    if (String(intent.get('user_id')) !== String(userId)) {
      throw supportError('That contribution was started by a different Hylo account', 'SUPPORT_INTENT_MISMATCH')
    }

    if (PENDING_STATUSES.includes(node.status)) {
      // The daily sync (or webhook) finishes the intent once OC marks it paid
      return { outcome: 'pending', supporterStatus: await SupporterService.userStatus(userId), groupId: intent.get('group_id') }
    }
    if (!PAID_STATUSES.includes(node.status)) {
      throw supportError('That contribution has not been paid', 'SUPPORT_ORDER_NOT_PAID', { orderStatus: node.status })
    }

    const groupId = await SupporterService.completeIntent(intent, row)
    return { outcome: 'confirmed', supporterStatus: await SupporterService.userStatus(userId), groupId }
  },

  /** After a sync: finish intents whose orders are now paid (e.g. the user never came back to Hylo). */
  async completeIntentsForOrders (rows) {
    let completed = 0
    for (const row of rows || []) {
      const token = SupportIntent.tokenFromTags(row.tags)
      if (!token || !row.oc_account_id || !PAID_STATUSES.includes(row.status)) continue
      const intent = await SupportIntent.findByToken(token)
      if (!intent) continue
      if (intent.get('completed_at') && intent.get('oc_order_id') === row.oc_order_id) continue
      try {
        await SupporterService.completeIntent(intent, row)
        completed++
      } catch (e) {
        const logger = global.sails && global.sails.log
        if (logger) logger.warn(`Could not complete support intent ${intent.id}: ${e.message}`)
      }
    }
    return completed
  },

  /** A contribution counts for its owner plus at most one group they administer. */
  async attributeContribution (userId, contributionId, groupId) {
    const order = await OpenCollectiveOrder.where({ id: contributionId }).fetch()
    const link = order && await SupporterLink.where({ user_id: userId, oc_account_id: order.get('oc_account_id') }).fetch()
    if (!order || !link) throw supportError('Contribution not found', 'SUPPORT_CONTRIBUTION_NOT_FOUND')
    if (groupId) await assertGroupAdmin(userId, groupId)
    await order.save({
      attributed_group_id: groupId || null,
      attributed_by_id: groupId ? userId : null
    }, { patch: true })
    return order
  },

  async setBadgeVisibility (userId, { groupId, show }) {
    if (groupId) {
      await assertGroupAdmin(userId, groupId)
      const group = await Group.find(groupId)
      await group.addSetting({ [BADGE_SETTING]: !!show }, true)
    } else {
      const user = await User.find(userId)
      await user.addSetting({ [BADGE_SETTING]: !!show }, true)
    }
    return true
  },

  /** Groups (not spaces) where this user holds the Administration responsibility. */
  async adminGroups (userId) {
    const groups = await Group.query(q => {
      q.join('group_memberships', 'group_memberships.group_id', 'groups.id')
      q.where({ 'group_memberships.user_id': userId, 'group_memberships.active': true, 'groups.active': true })
      Group.excludeSpaces(q)
      q.orderBy('groups.name')
    }).fetchAll()
    const checks = await Promise.all(groups.models.map(g => isGroupAdmin(userId, g.id)))
    return groups.models.filter((g, i) => checks[i])
  },

  /** Everything the user's own "Support Hylo" settings need. */
  async supportInfo (userId) {
    const user = await User.find(userId)
    const now = new Date()
    const contributions = await OpenCollectiveOrder.query(q => {
      q.join('supporter_links', 'supporter_links.oc_account_id', 'open_collective_orders.oc_account_id')
      q.where('supporter_links.user_id', userId)
      q.orderByRaw('COALESCE(open_collective_orders.last_charged_at, open_collective_orders.oc_created_at) DESC NULLS LAST')
    }).fetchAll({ withRelated: ['attributedGroup'] })
    const grant = await SupporterGrant.active(now).query(q => {
      q.where('user_id', userId)
      q.orderByRaw('expires_at DESC NULLS FIRST')
    }).fetch()

    return {
      checkAvailable: OpenCollectiveService.isConfigured(),
      supporterStatus: await SupporterService.userStatus(userId, now),
      showSupporterBadge: !!(user && user.getSetting(BADGE_SETTING) === true),
      hasIncognitoContributions: contributions.models.some(c => c.get('is_incognito')),
      manualGrant: !!grant,
      manualGrantExpiresAt: grant ? grant.get('expires_at') : null,
      contributions: contributions.models,
      adminGroups: await SupporterService.adminGroups(userId)
    }
  },

  async groupSupportInfo (userId, groupId) {
    await assertGroupAdmin(userId, groupId)
    const group = await Group.find(groupId)
    return {
      supporterStatus: await SupporterService.groupStatus(groupId),
      showSupporterBadge: !!(group && group.getSetting(BADGE_SETTING) === true)
    }
  },

  // ---- Hylo staff (/management) ----

  async grant (adminId, { userId, groupId, note, expiresAt }) {
    await assertStaff(adminId)
    if (!userId === !groupId) throw new GraphQLError('Choose either a person or a group')
    const expires = expiresAt ? new Date(expiresAt) : null
    if (expires && (isNaN(expires.getTime()) || expires <= new Date())) {
      throw new GraphQLError('The expiry date must be in the future')
    }
    if (userId && !(await User.find(userId))) throw new GraphQLError('Person not found')
    if (groupId && !(await Group.find(groupId))) throw new GraphQLError('Group not found')

    const attrs = {
      note: (note || '').trim() || null,
      expires_at: expires,
      granted_by_id: adminId
    }
    // One active grant per target: granting again updates it
    const existing = await SupporterGrant.active().query(q => {
      q.where(userId ? { user_id: userId } : { group_id: groupId })
    }).fetch()
    if (existing) return existing.save(attrs, { patch: true })
    return SupporterGrant.forge({ ...attrs, user_id: userId || null, group_id: groupId || null }).save()
  },

  async revoke (adminId, grantId) {
    await assertStaff(adminId)
    const grant = await SupporterGrant.where({ id: grantId }).fetch()
    if (!grant) throw new GraphQLError('Grant not found')
    if (!grant.get('revoked_at')) {
      await grant.save({ revoked_at: new Date(), revoked_by_id: adminId }, { patch: true })
    }
    return true
  },

  async listGrants (adminId) {
    await assertStaff(adminId)
    const grants = await SupporterGrant.active().query(q => q.orderBy('created_at', 'desc')).fetchAll()
    return grants.models
  }
}

module.exports = SupporterService
