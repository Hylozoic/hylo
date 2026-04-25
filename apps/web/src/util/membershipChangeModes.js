/**
 * Membership change modes where Stripe/Hylo apply the swap at period end (or lifetime checkout path),
 * not immediately. Used to avoid optimistic "already on new plan" UI and to refetch transactions right away.
 */
const DEFERRED_TO_PERIOD_END_MODES = new Set([
  'scheduled_period_end',
  'lifetime_no_proration'
])

export function membershipChangeDefersToPeriodEnd (mode) {
  return Boolean(mode && DEFERRED_TO_PERIOD_END_MODES.has(mode))
}
