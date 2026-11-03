/**
 * Hylo Pro management (the /management Hylo Pro page). Hylo staff only: every resolver checks
 * Admin.isSuperAdmin (the HYLO_ADMINS list) — group administrators are refused like anyone else.
 */

import { GraphQLError } from 'graphql'
import HyloProAdminService from '../../services/HyloProAdminService'

/* global Admin */

async function requireStaff (userId) {
  if (!userId || !(await Admin.isSuperAdmin(userId))) {
    throw new GraphQLError('Unauthorized: Admin access required')
  }
}

// A hylo_pro_subscriptions row as the HyloProAdminSubscription GraphQL type
export async function presentAdminSubscription (row) {
  if (!row) return null
  if (!row.relations.group || !row.relations.grantedBy) await row.load(['group', 'grantedBy'])
  const group = row.relations.group
  const grantedBy = row.relations.grantedBy
  return {
    id: row.id,
    source: row.get('source'),
    status: row.get('status'),
    active: row.isActive(),
    interval: row.get('interval'),
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
    createdAt: row.get('created_at')
  }
}

export async function hyloProMetrics (userId) {
  await requireStaff(userId)
  return HyloProAdminService.metrics()
}

export async function hyloProSubscriptions (userId, { filter, search, first, offset }) {
  await requireStaff(userId)
  const { items, total, hasMore } = await HyloProAdminService.listSubscriptions({ filter: filter || undefined, search, first, offset })
  return { items: await Promise.all(items.map(presentAdminSubscription)), total, hasMore }
}

export async function hyloProPayments (userId, { groupId }) {
  await requireStaff(userId)
  return HyloProAdminService.listPayments({ groupId })
}

export async function grantHyloPro (userId, { groupId, expiresAt, note }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.grant({ adminId: userId, groupId, expiresAt, note }))
}

export async function updateHyloProGrant (userId, { id, expiresAt, note }) {
  await requireStaff(userId)
  return presentAdminSubscription(await HyloProAdminService.updateGrant({ adminId: userId, id, expiresAt, note }))
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

export async function refundHyloProPayment (userId, { groupId, chargeId, amount }) {
  await requireStaff(userId)
  return HyloProAdminService.refundPayment({ adminId: userId, groupId, chargeId, amount })
}
