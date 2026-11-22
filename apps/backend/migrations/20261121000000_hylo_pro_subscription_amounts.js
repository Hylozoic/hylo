/**
 * What each Hylo Pro Stripe subscription actually pays (#1735, Q-15).
 *
 * MRR used to be computed from the current plan prices, so a coupon or a price change made it
 * wrong. HyloProService.syncSubscription now stores the subscription's own price and discount on
 * every sync, and HyloProAdminService computes MRR from these columns. Existing rows are filled in
 * by the daily Stripe re-sync (until then MRR falls back to the plan price for them).
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('hylo_pro_subscriptions', function (table) {
    table.integer('amount').nullable()
      .comment('Stripe rows: price per billing period in minor units (price.unit_amount x quantity), before discounts')
    table.string('currency', 3).nullable()
      .comment('Stripe rows: currency of amount, lowercase ISO code')
    table.integer('interval_count').nullable()
      .comment('Stripe rows: billing period length in units of interval (e.g. 3 for every 3 months)')
    table.string('discount_coupon_id', 255).nullable()
      .comment('Stripe rows: coupon of the discount applied to the subscription, if any')
    table.decimal('discount_percent_off', 7, 4).nullable()
      .comment('Stripe rows: percent off of that coupon')
    table.integer('discount_amount_off').nullable()
      .comment('Stripe rows: amount off of that coupon, in minor units of discount_currency')
    table.string('discount_currency', 3).nullable()
      .comment('Stripe rows: currency of discount_amount_off')
    table.string('discount_duration', 16).nullable()
      .comment("Stripe rows: coupon duration: 'once', 'repeating' or 'forever'")
    table.timestamp('discount_ends_at', { useTz: true }).nullable()
      .comment('Stripe rows: when a repeating discount stops applying; null for once/forever')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('hylo_pro_subscriptions', function (table) {
    table.dropColumn('discount_ends_at')
    table.dropColumn('discount_duration')
    table.dropColumn('discount_currency')
    table.dropColumn('discount_amount_off')
    table.dropColumn('discount_percent_off')
    table.dropColumn('discount_coupon_id')
    table.dropColumn('interval_count')
    table.dropColumn('currency')
    table.dropColumn('amount')
  })
}
