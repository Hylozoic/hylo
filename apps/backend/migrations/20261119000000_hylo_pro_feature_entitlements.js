/**
 * Hylo Pro per-feature entitlements (#1712).
 *
 * Pro is bundled into tiers, but each feature has its own check (see packages/shared
 * HyloProFeatures.js, the registry of features and the tier each belongs to). A row's `tier` says
 * which bundle it gives; `features` holds per-row overrides, `{ "<featureKey>": true | false }`:
 * true adds a feature the tier doesn't include, false removes one it does. Used by staff grants;
 * Stripe rows get their tier from the price. What a group has is computed on read from its active
 * rows (HyloProSubscription.featuresForGroup), never stored per group.
 */
exports.up = async function (knex) {
  await knex.schema.alterTable('hylo_pro_subscriptions', function (table) {
    table.string('tier', 16).notNullable().defaultTo('pro')
      .comment("Bundle this row gives: 'pro', 'pro_plus' or 'custom' (see HyloProFeatures in packages/shared)")
    table.jsonb('features').nullable()
      .comment('Per-row overrides of the tier bundle: { "<featureKey>": true (added) | false (removed) }')
  })

  await knex.raw(`
    ALTER TABLE hylo_pro_subscriptions
    ADD CONSTRAINT hylo_pro_subscriptions_tier_check CHECK (tier IN ('pro', 'pro_plus', 'custom'))
  `)
}

exports.down = async function (knex) {
  await knex.raw('ALTER TABLE hylo_pro_subscriptions DROP CONSTRAINT IF EXISTS hylo_pro_subscriptions_tier_check')
  await knex.schema.alterTable('hylo_pro_subscriptions', function (table) {
    table.dropColumn('features')
    table.dropColumn('tier')
  })
}
