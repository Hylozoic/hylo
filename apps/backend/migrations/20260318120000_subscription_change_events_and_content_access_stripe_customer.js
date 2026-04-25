exports.up = async function (knex) {
  await knex.schema.table('content_access', function (table) {
    table.string('stripe_customer_id', 255).nullable()
      .comment('Stripe customer id (cus_...) on the connected account; set at checkout completion')
  })

  await knex.schema.createTable('subscription_change_events', function (table) {
    table.bigIncrements('id').primary()
    table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('correlation_id', 64).notNullable().unique()
    table.bigInteger('from_product_id').unsigned().nullable().references('id').inTable('stripe_products').onDelete('SET NULL')
    table.bigInteger('to_product_id').unsigned().nullable().references('id').inTable('stripe_products').onDelete('SET NULL')
    table.string('mode', 64).notNullable()
    table.string('stripe_subscription_id', 255).nullable()
    table.string('stripe_customer_id', 255).nullable()
    table.string('status', 32).notNullable().defaultTo('pending')
    table.jsonb('payload').notNullable().defaultTo('{}')
    table.timestamp('pending_effective_at').nullable()
    table.timestamp('applied_at').nullable()
    table.text('error_message').nullable()
    table.timestamps(true, true)

    table.index(['user_id', 'group_id'])
    table.index(['status'])
    table.index(['stripe_subscription_id'])
  })

  await knex.schema.createTable('stripe_webhook_processed_events', function (table) {
    table.string('stripe_event_id', 255).primary()
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('stripe_webhook_processed_events')
  await knex.schema.dropTableIfExists('subscription_change_events')
  await knex.schema.table('content_access', function (table) {
    table.dropColumn('stripe_customer_id')
  })
}
