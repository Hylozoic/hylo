/**
 * Hylo-defined unused prepaid credit for immediate membership upgrades.
 * Linear in time: (remaining / period length) × period price.
 * See docs/SUBSCRIPTION_CHANGE_V1_TODO.md (billing model revision).
 */

/** Hylo DB list price in cents (strictly positive), or 0 if unset. */
function productListPriceCents (fromProduct) {
  const raw = fromProduct?.get?.('price_in_cents')
  const n = typeof raw === 'string' ? parseInt(raw, 10) : Number(raw)
  return Number.isFinite(n) && n > 0 ? n : 0
}

/**
 * Per-period unit amount in cents from the subscription line (no extra Stripe calls).
 * Prefer expanded `price.unit_amount`, then legacy `plan.amount`, then Hylo product list price.
 *
 * @param {object} subscription
 * @param {object} fromProduct
 * @returns {number|null} null if unknown (caller may fetch Price from Stripe)
 */
function resolvePeriodUnitAmountCentsSync (subscription, fromProduct) {
  const item = subscription.items?.data?.[0]
  if (!item) {
    const p = productListPriceCents(fromProduct)
    return p > 0 ? p : null
  }
  const price = item.price
  const plan = item.plan
  if (price && typeof price === 'object' && price.unit_amount != null) {
    return price.unit_amount
  }
  if (plan && typeof plan === 'object' && plan.amount != null) {
    return plan.amount
  }
  if (typeof item.unit_amount === 'number' && item.unit_amount >= 0) {
    return item.unit_amount
  }
  if (typeof price === 'string') {
    return null
  }
  if (price && typeof price === 'object' && price.id != null && price.unit_amount == null) {
    return null
  }
  const fallback = productListPriceCents(fromProduct)
  return fallback > 0 ? fallback : null
}

function resolvePeriodPriceCentsForCredit (subscription, fromProduct) {
  const item = subscription.items?.data?.[0]
  const qty = item && item.quantity != null ? item.quantity : 1
  let unit = resolvePeriodUnitAmountCentsSync(subscription, fromProduct)
  if (unit == null) {
    unit = productListPriceCents(fromProduct)
  }
  if (!Number.isFinite(unit) || unit < 0) return 0
  return Math.round(unit * qty)
}

/**
 * Stripe subscription vs item-level billing period (some APIs expose period on the item).
 *
 * @param {object} subscription
 * @returns {{ periodStartSec: number|null, periodEndSec: number|null }}
 */
function resolveSubscriptionBillingPeriodSeconds (subscription) {
  let start = subscription.current_period_start
  let end = subscription.current_period_end
  const item0 = subscription.items?.data?.[0]
  if (item0) {
    if (start == null && item0.current_period_start != null) {
      start = item0.current_period_start
    }
    if (end == null && item0.current_period_end != null) {
      end = item0.current_period_end
    }
  }
  return { periodStartSec: start ?? null, periodEndSec: end ?? null }
}

/**
 * @param {object} params
 * @param {number} params.periodStartSec
 * @param {number} params.periodEndSec
 * @param {number} [params.nowSec] Unix seconds; defaults to now
 * @param {number} params.periodPriceCents Full-period price attributed to this subscription
 * @returns {number} Credit in cents, 0 … periodPriceCents
 */
function computeUnusedPrepaidCreditCents ({
  periodStartSec,
  periodEndSec,
  nowSec = Math.floor(Date.now() / 1000),
  periodPriceCents
}) {
  if (periodPriceCents <= 0) return 0
  if (periodEndSec <= periodStartSec) return 0
  const remaining = periodEndSec - nowSec
  if (remaining <= 0) return 0
  const total = periodEndSec - periodStartSec
  const fraction = remaining / total
  const raw = Math.round(periodPriceCents * fraction)
  return Math.min(periodPriceCents, Math.max(0, raw))
}

/**
 * @param {object} subscription
 * @param {object} fromProduct
 * @param {number} [nowSec]
 * @param {number} [resolvedPeriodPriceCents] if passed (including 0), used as full period price; else sync resolution
 */
function computeHyloUnusedPrepaidCreditCents (subscription, fromProduct, nowSec, resolvedPeriodPriceCents) {
  const { periodStartSec, periodEndSec } = resolveSubscriptionBillingPeriodSeconds(subscription)
  if (periodStartSec == null || periodEndSec == null) return 0
  const periodPriceCents = resolvedPeriodPriceCents !== undefined
    ? resolvedPeriodPriceCents
    : resolvePeriodPriceCentsForCredit(subscription, fromProduct)
  return computeUnusedPrepaidCreditCents({
    periodStartSec,
    periodEndSec,
    nowSec: nowSec != null ? nowSec : Math.floor(Date.now() / 1000),
    periodPriceCents
  })
}

module.exports = {
  productListPriceCents,
  resolvePeriodUnitAmountCentsSync,
  resolvePeriodPriceCentsForCredit,
  resolveSubscriptionBillingPeriodSeconds,
  computeUnusedPrepaidCreditCents,
  computeHyloUnusedPrepaidCreditCents
}
