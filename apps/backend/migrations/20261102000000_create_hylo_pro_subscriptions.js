/**
 * Hylo Pro: a group paying Hylo (on the platform Stripe account, not Connect) for extra features.
 *
 * One row per Stripe subscription (source 'stripe'), kept in sync by webhooks, or per manual
 * grant made by Hylo admins (source 'manual', optionally expiring at expires_at).
 * A group has Pro while any of its rows is active (see HyloProSubscription.isActive).
 *
 * hylo_pro_customers records the one platform Stripe customer each group pays with, created
 * before its first Checkout, so every Checkout and portal session for the group uses the same
 * customer and Stripe can be asked for that customer's existing subscriptions.
 */
exports.up = async function (knex) {
  await knex.schema.createTable('hylo_pro_subscriptions', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('source', 16).notNullable().defaultTo('stripe')
      .comment("'stripe' (paid subscription) or 'manual' (granted by a Hylo admin)")
    table.string('status', 32).notNullable()
      .comment('Stripe subscription status (active, trialing, past_due, canceled, ...); manual grants use active/canceled')
    table.string('interval', 16).nullable().comment("Billing interval: 'month' or 'year'")
    table.string('stripe_customer_id', 255).nullable().comment('Customer (cus_...) on the platform account')
    table.string('stripe_subscription_id', 255).nullable().unique()
    table.string('stripe_price_id', 255).nullable()
    table.timestamp('current_period_end', { useTz: true }).nullable()
    table.boolean('cancel_at_period_end').notNullable().defaultTo(false)
    table.timestamp('cancel_at', { useTz: true }).nullable().comment('When a scheduled cancellation takes effect')
    table.timestamp('canceled_at', { useTz: true }).nullable()
    table.timestamp('ended_at', { useTz: true }).nullable()
    table.timestamp('expires_at', { useTz: true }).nullable().comment('End of a manual grant; null = no end date')
    table.bigInteger('granted_by_id').unsigned().nullable().references('id').inTable('users').onDelete('SET NULL')
    table.text('note').nullable()
    table.timestamps(true, true)

    table.index(['group_id'])
    table.index(['stripe_customer_id'])
  })

  await knex.raw(`
    ALTER TABLE hylo_pro_subscriptions
    ADD CONSTRAINT hylo_pro_subscriptions_source_check CHECK (source IN ('stripe', 'manual'))
  `)

  await knex.schema.createTable('hylo_pro_customers', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').unsigned().notNullable().unique().references('id').inTable('groups').onDelete('CASCADE')
    table.string('stripe_customer_id', 255).notNullable().unique().comment('Customer (cus_...) on the platform account')
    table.timestamps(true, true)
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('hylo_pro_customers')
  await knex.schema.dropTableIfExists('hylo_pro_subscriptions')
}
