// Open Collective supporter badges (#1754).
//
// open_collective_orders: a local copy of the contributions made to Hylo's
//   Open Collective, refreshed by OpenCollectiveService.syncOrders. The
//   attributed_* columns are Hylo-side and are never touched by the sync.
// supporter_links: which Open Collective account belongs to which Hylo user.
//   Rows are only created when the user asks (email check or donation flow).
// support_intents: a random token sent to Open Collective as a tag when a
//   user starts a donation from Hylo, so the order can be matched afterwards.
// supporter_grants: supporter status given by Hylo staff for non-monetary
//   contributions, to a user or a group.
exports.up = async function (knex) {
  await knex.schema.createTable('open_collective_orders', table => {
    table.increments('id').primary()
    table.text('oc_order_id').notNullable().unique()
    table.text('oc_account_id')
    table.text('oc_account_slug')
    table.text('account_type')
    table.boolean('is_incognito').notNullable().defaultTo(false)
    table.text('status')
    table.text('frequency')
    table.text('currency')
    table.timestamp('oc_created_at')
    table.timestamp('last_charged_at')
    table.specificType('tags', 'text[]')
    table.jsonb('raw')
    table.bigInteger('attributed_group_id').references('id').inTable('groups').onDelete('SET NULL')
    table.bigInteger('attributed_by_id').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.index(['oc_account_id'])
    table.index(['attributed_group_id'])
  })

  await knex.schema.createTable('supporter_links', table => {
    table.increments('id').primary()
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.text('oc_account_id').notNullable().unique()
    table.text('oc_account_slug')
    table.text('method').notNullable()
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.index(['user_id'])
  })

  await knex.schema.createTable('support_intents', table => {
    table.increments('id').primary()
    table.text('token').notNullable().unique()
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('group_id').references('id').inTable('groups').onDelete('SET NULL')
    table.text('oc_order_id')
    table.timestamp('completed_at')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.index(['user_id'])
  })

  await knex.schema.createTable('supporter_grants', table => {
    table.increments('id').primary()
    table.bigInteger('user_id').references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('group_id').references('id').inTable('groups').onDelete('CASCADE')
    table.text('note')
    table.timestamp('expires_at')
    table.bigInteger('granted_by_id').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('revoked_at')
    table.bigInteger('revoked_by_id').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
    table.index(['user_id'])
    table.index(['group_id'])
  })

  await knex.raw(`
    ALTER TABLE supporter_grants
    ADD CONSTRAINT supporter_grants_one_target CHECK ((user_id IS NULL) <> (group_id IS NULL))
  `)
}

exports.down = async function (knex) {
  await knex.schema.dropTable('supporter_grants')
  await knex.schema.dropTable('support_intents')
  await knex.schema.dropTable('supporter_links')
  await knex.schema.dropTable('open_collective_orders')
}
