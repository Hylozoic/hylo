/**
 * Hylo Pro management (the /management Hylo Pro page). Hylo staff only: every resolver checks
 * Admin.isSuperAdmin (the HYLO_ADMINS list) — group administrators are refused like anyone else.
 */

import { GraphQLError } from 'graphql'
import HyloProAdminService from '../../services/HyloProAdminService'

/* global Admin, HyloProSubscription */

async function requireStaff (userId) {
  if (!userId || !(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }
}

// A row's stored discount (Stripe rows), or null when it has none
function presentDiscount (row) {
  if (!row.get('discount_coupon_id')) return null
  const percentOff = row.get('discount_percent_off')
  return {
    couponId: row.get('discount_coupon_id'),
    percentOff: percentOff === null || percentOff === undefined ? null : Number(percentOff),
    amountOff: row.get('discount_amount_off'),
    currency: row.get('discount_currency'),
    duration: row.get('discount_duration'),
    endsAt: row.get('discount_ends_at')
  }
}

/**
 * A hylo_pro_subscriptions row as the HyloProAdminSubscription GraphQL type. `chargeCounts` (from
 * HyloProAdminService.chargeEventCounts, keyed by group id) avoids a query per row in lists; when
 * it isn't given, the row's group is looked up.
 */
export async function presentAdminSubscription (row, chargeCounts) {
  if (!row) return null
  if (!row.relations.group || !row.relations.grantedBy) await row.load(['group', 'grantedBy'])
  const group = row.relations.group
  const grantedBy = row.relations.grantedBy
  const isStripe = row.get('source') === HyloProSubscription.SOURCE_STRIPE
  const counts = isStripe
    ? (chargeCounts || await HyloProAdminService.chargeEventCounts([row.get('group_id')])).get(String(row.get('group_id')))
    : null
  const revenue = isStripe ? HyloProAdminService.monthlyRevenue(row) : null
  return {
    id: row.id,
    source: row.get('source'),
    status: row.get('status'),
    active: row.isActive(),
    interval: row.get('interval'),
    tier: row.tier(),
    features: Object.entries(row.featureOverrides()).map(([key, enabled]) => ({ key, enabled })),
    group: group && group.id ? { id: group.id, name: group.get('name'), slug: group.get('slug') } : null,
    grantedBy: grantedBy && grantedBy.id ? { id: grantedBy.id, name: grantedBy.get('name') } : null,
    note: row.get('note'),
    expiresAt: row.get('expires_at'),
    stripeSubscriptionId: row.get('stripe_subscription_id'),
    stripeCustomerId: row.get('stripe_customer_id'),
    currentPeriodEnd: row.get('current_period_end'),
    cancelAtPeriodEnd: !!(row.get('cancel_at_period_end') || row.get('cancel_at')),
    endsAt: row.endsAt(),
    canceledAt: row.get('canceled_at'),
    endedAt: row.get('ended_at'),
    createdAt: row.get('created_at'),
    amount: row.get('amount'),
    currency: row.get('currency'),
    intervalCount: row.get('interval_count'),
    discount: presentDiscount(row),
    monthlyRevenueCents: revenue && !revenue.estimated ? Math.round(revenue.cents) : null,
    openDisputes: counts ? counts.openDisputes : 0,
    refunds: counts ? counts.refunds : 0
  }
}

export async function hyloProMetrics (userId) {
  await requireStaff(userId)
  return HyloProAdminService.metrics()
}

export async function hyloProSubscriptions (userId, { filter, search, first, offset }) {
  await requireStaff(userId)
  const { items, total, hasMore } = await HyloProAdminService.listSubscriptions({ filter: filter || undefined, search, first, offset })
  const chargeCounts = await HyloProAdminService.chargeEventCounts(items.map(row => row.get('group_id')))
  return { items: await Promise.all(items.map(row => presentAdminSubscription(row, chargeCounts))), total, hasMore }
}

// Groups a "slug or ID" typed by staff could mean, so they confirm the group before granting
export async function hyloProGroups (userId, { slugOrId }) {
  await requireStaff(userId)
  const groups = await HyloProAdminService.findGroups(slugOrId)
  return groups.map(group => ({ id: group.id, name: group.get('name'), slug: group.get('slug'), type: group.get('type') }))
}

// Pro refunds and disputes recorded from Stripe webhooks for one group
export async function hyloProChargeEvents (userId, { groupId }) {
  await requireStaff(userId)
  return HyloProAdminService.listChargeEvents({ groupId })
}

export async function hyloProPayments (userId, { groupId, after }) {
  await requireStaff(userId)
  return HyloProAdminService.listPayments({ groupId, after })
}

// tier: 'pro' (default), 'pro_plus' or 'custom'; features: [{ key, enabled }] overrides of that tier's bundle
export async function grantHyloPro (userId, { groupId, tier, features, expiresAt, note }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.grant({ adminId: userId, groupId, tier, features, expiresAt, note }))
}

export async function updateHyloProGrant (userId, { id, tier, features, expiresAt, note }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.updateGrant({ adminId: userId, id, tier, features, expiresAt, note }))
}

export async function revokeHyloProGrant (userId, { id }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.revokeGrant({ adminId: userId, id }))
}

export async function cancelHyloProSubscription (userId, { id, immediately }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.cancelSubscription({ adminId: userId, id, immediately: !!immediately }))
}

export async function resumeHyloProSubscription (userId, { id }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.resumeSubscription({ adminId: userId, id }))
}

export async function extendHyloProSubscription (userId, { id, days }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.extendSubscription({ adminId: userId, id, days }))
}

export async function refundHyloProPayment (userId, { groupId, chargeId, amount, cancelSubscriptionId }) {
  await requireStaff(userId)
  return HyloProAdminService.refundPayment({ adminId: userId, groupId, chargeId, amount, cancelSubscriptionId })
}
