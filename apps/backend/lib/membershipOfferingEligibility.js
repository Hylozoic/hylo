/**
 * Helpers for "group membership" paid offerings (subscription change v1).
 * Aligns with web `util/accessGrants` where possible.
 */

/**
 * Whether this product grants access to the given group (for paywall / membership).
 * If access_grants has no groupIds, the selling group (product.group_id) is the default scope.
 *
 * @param {object} product - Bookshelf StripeProduct model
 * @param {string|number} groupId
 * @returns {boolean}
 */
function productGrantsGroupAccess (product, groupId) {
  if (!product || groupId == null) return false
  const gid = parseInt(groupId, 10)
  if (isNaN(gid) || gid <= 0) return false

  const ownerGroupId = parseInt(product.get('group_id'), 10)
  const ag = product.get('access_grants') || {}

  if (ag.groupIds && Array.isArray(ag.groupIds) && ag.groupIds.length > 0) {
    return ag.groupIds.some(id => parseInt(id, 10) === gid)
  }

  return ownerGroupId === gid
}

/**
 * Recurring subscription offerings: automatic renewal + a recurring duration.
 * Excludes `day` from production eligibility lists (test-only).
 *
 * @param {object} product - Bookshelf StripeProduct
 * @param {object} [options]
 * @param {boolean} [options.includeDayDuration] - default false
 * @returns {boolean}
 */
function isRecurringSubscriptionOffering (product, { includeDayDuration = false } = {}) {
  if (!product) return false
  if (product.get('renewal_policy') !== 'automatic') return false
  const d = product.get('duration')
  const allowed = includeDayDuration
    ? ['day', 'month', 'season', 'annual']
    : ['month', 'season', 'annual']
  return typeof d === 'string' && allowed.includes(d)
}

/**
 * One-time / lifetime style (not a recurring subscription for change rules).
 *
 * @param {object} product - Bookshelf StripeProduct
 * @returns {boolean}
 */
function isLifetimeOrOneTimeOffering (product) {
  if (!product) return false
  return !isRecurringSubscriptionOffering(product, { includeDayDuration: true })
}

module.exports = {
  productGrantsGroupAccess,
  isRecurringSubscriptionOffering,
  isLifetimeOrOneTimeOffering
}
