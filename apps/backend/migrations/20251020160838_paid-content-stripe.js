exports.up = function (knex) {
  return knex.schema
    // First, drop the existing foreign key from users to stripe_accounts
    .table('users', function (table) {
      table.dropForeign(['stripe_account_id'])
      table.dropColumn('stripe_account_id')
    })
    // Add Stripe columns to groups table
    .table('groups', function (table) {
      table.bigInteger('stripe_account_id').unsigned().references('id').inTable('stripe_accounts')
      table.boolean('stripe_charges_enabled').defaultTo(false)
      table.boolean('stripe_payouts_enabled').defaultTo(false)
      table.boolean('stripe_details_submitted').defaultTo(false)
    })
    // Create stripe_products table to track products associated with groups
    .createTable('stripe_products', function (table) {
      table.bigIncrements('id').primary()
      table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups').onDelete('CASCADE')
      table.string('stripe_product_id', 255).notNullable()
      table.string('stripe_price_id', 255).notNullable()
      table.string('name', 255).notNullable()
      table.text('description')
      table.integer('price_in_cents').notNullable()
      table.string('currency', 3).notNullable().defaultTo('usd')
      table.boolean('active').defaultTo(true)
      table.bigInteger('track_id').unsigned().references('id').inTable('tracks')
      table.timestamps(true, true)

      table.index(['group_id'])
      table.index(['stripe_product_id'])
    })
    // Create content_access table to track all content access grants (paid and free)
    // This supports both Stripe purchases and admin-granted free access
    .createTable('content_access', function (table) {
      table.bigIncrements('id').primary()
      table.bigInteger('user_id').unsigned().notNullable().references('id').inTable('users')
      table.bigInteger('group_id').unsigned().notNullable().references('id').inTable('groups')
      table.bigInteger('product_id').unsigned().references('id').inTable('stripe_products')
      table.bigInteger('track_id').unsigned().references('id').inTable('tracks')
      table.integer('role_id').unsigned().references('id').inTable('groups_roles')

      // Access type: 'stripe_purchase', 'admin_grant', 'free'
      table.string('access_type', 50).notNullable()

      // Stripe-specific fields (nullable for non-Stripe grants)
      table.string('stripe_session_id', 255)
      table.string('stripe_payment_intent_id', 255)
      table.integer('amount_paid').defaultTo(0) // 0 for free grants
      table.string('currency', 3).defaultTo('usd')

      // Status: 'active', 'expired', 'revoked'
      table.string('status', 50).notNullable().defaultTo('active')

      // Who granted access (for admin grants)
      table.bigInteger('granted_by_id').unsigned().references('id').inTable('users')

      // Optional expiration
      table.timestamp('expires_at')

      // Flexible metadata for additional info
      table.jsonb('metadata').defaultTo('{}')

      table.timestamps(true, true)

      table.index(['user_id', 'status'])
      table.index(['group_id'])
      table.index(['product_id'])
      table.index(['track_id'])
      table.index(['role_id'])
      table.index(['stripe_session_id'])
      table.index(['access_type'])
      table.index(['status'])
    })
}

exports.down = function (knex) {
  return knex.schema
    // Drop the new tables
    .dropTableIfExists('content_access')
    .dropTableIfExists('stripe_products')
    // Remove Stripe columns from groups table
    .table('groups', function (table) {
      table.dropForeign(['stripe_account_id'])
      table.dropColumn('stripe_account_id')
      table.dropColumn('stripe_charges_enabled')
      table.dropColumn('stripe_payouts_enabled')
      table.dropColumn('stripe_details_submitted')
    })
    // Restore the stripe_account_id column to users table
    .table('users', function (table) {
      table.bigInteger('stripe_account_id').unsigned().references('id').inTable('stripe_accounts')
    })
}
