/**
 * Experimental: AT Protocol (did:plc) identities for Hylo users, with Hylo acting as their PDS.
 *
 * status:
 * - pending: genesis op built and stored, not yet accepted by the PLC directory (safe to resubmit)
 * - active: DID registered; handle resolves
 * - tombstoned: DID deactivated at the PLC directory; handle released
 */

exports.up = async function (knex) {
  await knex.schema.createTable('atproto_identities', table => {
    table.increments().primary()
    table.bigInteger('user_id').references('id').inTable('users').notNullable()
    table.string('did').notNullable()
    table.string('handle').notNullable()
    table.string('status').notNullable().defaultTo('pending')
    table.string('signing_key_public').notNullable()
    table.text('signing_key_encrypted').notNullable()
    table.jsonb('genesis_op')
    table.timestamp('created_at')
    table.timestamp('updated_at')
    table.timestamp('tombstoned_at')

    table.unique(['user_id'])
    table.unique(['did'])
  })
  await knex.raw('alter table atproto_identities alter constraint atproto_identities_user_id_foreign deferrable initially deferred')
  // A tombstoned identity gives up its handle so it can be reused
  await knex.raw("create unique index atproto_identities_handle_unique on atproto_identities (handle) where status <> 'tombstoned'")
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('atproto_identities')
}
