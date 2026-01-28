/**
 * Migration: Add Developer Applications and Bot Support
 *
 * Creates:
 * - applications table for OAuth app registration
 * - bot_group_permissions table for bot access control
 * - Bot-related columns on users table
 */

exports.up = async function (knex) {
  // 1. Add bot columns to users table
  await knex.schema.alterTable('users', table => {
    table.boolean('is_bot').defaultTo(false)
    table.bigInteger('bot_owner_id').references('id').inTable('users')
    table.bigInteger('bot_application_id')
  })

  // 2. Create applications table
  await knex.schema.createTable('applications', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('owner_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('name', 255).notNullable()
    table.text('description')
    table.string('icon_url', 2048)
    table.string('client_id', 64).unique().notNullable()
    table.string('client_secret_hash', 255).notNullable()
    table.specificType('redirect_uris', 'text[]').defaultTo('{}')
    table.specificType('scopes', 'text[]').defaultTo('{openid,profile}')
    table.boolean('has_bot').defaultTo(false)
    table.bigInteger('bot_user_id').references('id').inTable('users')
    table.string('webhook_url', 2048)
    table.string('webhook_secret', 255)
    table.specificType('webhook_events', 'text[]').defaultTo('{}')
    table.boolean('is_public').defaultTo(false)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.timestamp('updated_at').defaultTo(knex.fn.now())
  })

  // 3. Create bot_group_permissions table
  await knex.schema.createTable('bot_group_permissions', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('bot_user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.bigInteger('invited_by_id').notNullable().references('id').inTable('users')
    table.specificType('permissions', 'text[]').defaultTo('{}')
    table.boolean('is_active').defaultTo(true)
    table.timestamp('created_at').defaultTo(knex.fn.now())
    table.unique(['bot_user_id', 'group_id'])
  })

  // 4. Add foreign key from users.bot_application_id to applications.id
  // (Done after applications table exists)
  await knex.schema.alterTable('users', table => {
    table.foreign('bot_application_id').references('id').inTable('applications')
  })

  // 5. Create index for faster lookups
  await knex.schema.alterTable('applications', table => {
    table.index('owner_id')
    table.index('client_id')
  })

  await knex.schema.alterTable('bot_group_permissions', table => {
    table.index('bot_user_id')
    table.index('group_id')
  })
}

exports.down = async function (knex) {
  // Remove foreign key from users first
  await knex.schema.alterTable('users', table => {
    table.dropForeign('bot_application_id')
  })

  // Drop tables in reverse order
  await knex.schema.dropTableIfExists('bot_group_permissions')
  await knex.schema.dropTableIfExists('applications')

  // Remove bot columns from users
  await knex.schema.alterTable('users', table => {
    table.dropColumn('bot_application_id')
    table.dropColumn('bot_owner_id')
    table.dropColumn('is_bot')
  })
}
