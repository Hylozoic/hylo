exports.up = async function (knex) {
  // Add stripe_subscription_id column to content_access table
  await knex.schema.table('content_access', table => {
    table.string('stripe_subscription_id', 255).nullable()
      .comment('Stripe subscription ID for recurring access (null for one-time purchases)')
  })

  // Add index for efficient queries by subscription ID
  await knex.raw(`
    CREATE INDEX content_access_stripe_subscription_id_index 
    ON content_access (stripe_subscription_id) 
    WHERE stripe_subscription_id IS NOT NULL
  `)

  // Remove stripe_payment_intent_id column (no longer needed with Checkout Session approach)
  await knex.schema.table('content_access', table => {
    table.dropColumn('stripe_payment_intent_id')
  })
}

exports.down = async function (knex) {
  // Re-add stripe_payment_intent_id column
  await knex.schema.table('content_access', table => {
    table.string('stripe_payment_intent_id', 255).nullable()
  })

  // Remove index
  await knex.schema.table('content_access', table => {
    table.dropIndex('stripe_subscription_id', 'content_access_stripe_subscription_id_index')
  })

  // Remove column
  await knex.schema.table('content_access', table => {
    table.dropColumn('stripe_subscription_id')
  })
}
