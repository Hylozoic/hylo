/**
 * Subscription change (v1) — decision rules for membership subscription swaps.
 *
 * Used by API / Stripe flows to choose immediate upgrade (Hylo credit + cycle reset) vs scheduled change.
 * Product rules: docs/SUBSCRIPTION_CHANGE_V1_TODO.md
 *
 * Notes:
 * - `day` duration is test-only: never use immediate proration paths for it.
 * - Billing period length uses the same mapping as Stripe (month=1mo, season=3mo, annual=1yr).
 */

/**
 * How the change should be applied in Stripe + Hylo.
 */
const SUBSCRIPTION_CHANGE_MODE = {
  /** Immediate upgrade: billing_cycle_anchor now, proration none, Hylo unused-prepaid credit */
  IMMEDIATE_UPGRADE: 'immediate_upgrade',
  /** New price/plan starts at current period end (no mid-cycle swap) */
  SCHEDULED_PERIOD_END: 'scheduled_period_end',
  /** Currency differs — this plan swap is not supported in v1 */
  CURRENCY_MISMATCH_BLOCKED: 'currency_mismatch_blocked',
  /** Target is one-time lifetime — no proration; old recurring access until natural expiry */
  LIFETIME_NO_PRORATION: 'lifetime_no_proration',
  /** Subscription past_due — no proration; new terms from change date */
  PAST_DUE_NO_PRORATION: 'past_due_no_proration',
  /** Sliding scale: quantity-only change; effective next billing cycle */
  SLIDING_SCALE_NEXT_CYCLE: 'sliding_scale_next_cycle'
}

/**
 * Maps Hylo `duration` to approximate months per billing period for ordering.
 * `day` is test-only — returns null so callers treat it as non-production.
 *
 * @param {string|null|undefined} duration
 * @returns {number|null}
 */
function getBillingPeriodMonths (duration) {
  if (duration == null || duration === '') return null
  switch (duration) {
    case 'day':
      return null
    case 'month':
      return 1
    case 'season':
      return 3
    case 'annual':
      return 12
    case 'lifetime':
      return null
    default:
      return null
  }
}

/**
 * Same recurring cadence (Hylo duration string === Stripe interval shape).
 *
 * @param {string|null|undefined} a
 * @param {string|null|undefined} b
 * @returns {boolean}
 */
function sameBillingPeriod (a, b) {
  if (a == null || b == null) return false
  return String(a) === String(b)
}

/**
 * Normalize currency for comparison (lowercase ISO).
 *
 * @param {string|null|undefined} currency
 * @returns {string}
 */
function normalizeCurrency (currency) {
  return (currency || '').toLowerCase().trim()
}

/**
 * Stripe-equivalent interval + count for a Hylo duration (for docs / parity with checkout).
 *
 * @param {string|null|undefined} duration
 * @returns {{ interval: string, intervalCount: number }|null}
 */
function getStripeBillingSpec (duration) {
  if (duration == null || duration === '') return null
  switch (duration) {
    case 'day':
      return { interval: 'day', intervalCount: 1 }
    case 'month':
      return { interval: 'month', intervalCount: 1 }
    case 'season':
      return { interval: 'month', intervalCount: 3 }
    case 'annual':
      return { interval: 'year', intervalCount: 1 }
    default:
      return null
  }
}

/**
 * Decide subscription change mode from current vs target offering fields.
 *
 * @param {object} input
 * @param {boolean} [input.isPastDue]
 * @param {boolean} [input.isSlidingScaleQuantityOnly]
 * @param {boolean} [input.targetIsLifetime]
 * @param {string|null|undefined} input.currentDuration
 * @param {string|null|undefined} input.targetDuration
 * @param {number} input.currentPriceCents
 * @param {number} input.targetPriceCents
 * @param {string|null|undefined} input.currentCurrency
 * @param {string|null|undefined} input.targetCurrency
 * @returns {{ mode: string, reason: string, meta?: object }}
 */
function resolveSubscriptionChangeMode (input) {
  const {
    isPastDue = false,
    isSlidingScaleQuantityOnly = false,
    targetIsLifetime = false,
    currentDuration,
    targetDuration,
    currentPriceCents = 0,
    targetPriceCents = 0,
    currentCurrency,
    targetCurrency
  } = input

  if (isPastDue) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.PAST_DUE_NO_PRORATION,
      reason: 'subscription_past_due'
    }
  }

  if (isSlidingScaleQuantityOnly) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.SLIDING_SCALE_NEXT_CYCLE,
      reason: 'sliding_scale_quantity_only'
    }
  }

  if (targetIsLifetime) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.LIFETIME_NO_PRORATION,
      reason: 'target_is_lifetime_one_time'
    }
  }

  const curCur = normalizeCurrency(currentCurrency)
  const tgtCur = normalizeCurrency(targetCurrency)
  if (curCur && tgtCur && curCur !== tgtCur) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.CURRENCY_MISMATCH_BLOCKED,
      reason: 'currency_mismatch',
      meta: { currentCurrency: curCur, targetCurrency: tgtCur }
    }
  }

  const curDur = currentDuration
  const tgtDur = targetDuration
  const involvesTestDay = curDur === 'day' || tgtDur === 'day'
  if (involvesTestDay) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END,
      reason: 'day_duration_test_only_no_immediate_proration'
    }
  }

  const curMonths = getBillingPeriodMonths(curDur)
  const tgtMonths = getBillingPeriodMonths(tgtDur)

  if (curMonths == null || tgtMonths == null) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END,
      reason: 'unknown_or_non_recurring_duration'
    }
  }

  if (tgtMonths > curMonths) {
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.IMMEDIATE_UPGRADE,
      reason: 'longer_billing_period',
      meta: { currentMonths: curMonths, targetMonths: tgtMonths }
    }
  }

  if (sameBillingPeriod(curDur, tgtDur)) {
    if (targetPriceCents > currentPriceCents) {
      return {
        mode: SUBSCRIPTION_CHANGE_MODE.IMMEDIATE_UPGRADE,
        reason: 'same_period_higher_price',
        meta: { currentPriceCents, targetPriceCents }
      }
    }
    return {
      mode: SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END,
      reason: 'same_period_same_or_lower_price'
    }
  }

  return {
    mode: SUBSCRIPTION_CHANGE_MODE.SCHEDULED_PERIOD_END,
    reason: 'shorter_period_or_other'
  }
}

module.exports = {
  SUBSCRIPTION_CHANGE_MODE,
  getBillingPeriodMonths,
  sameBillingPeriod,
  normalizeCurrency,
  getStripeBillingSpec,
  resolveSubscriptionChangeMode
}
