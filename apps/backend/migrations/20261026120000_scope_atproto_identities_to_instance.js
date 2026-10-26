/**
 * Experimental AT Protocol: bind each identity to the instance that created it (its PLC directory
 * and handle domain). A database cloned from another environment (e.g. prod → staging) then
 * carries identities that this instance treats as foreign: never written to its PLC or served.
 *
 * One identity per user becomes one identity per user per PLC directory.
 *
 * Existing rows are stamped with this environment's ATPROTO_PLC_URL; without it they are marked
 * 'unknown' and so treated as foreign everywhere.
 */

const normalizePlcUrl = url => (url || '').trim().toLowerCase().replace(/\/+$/, '')

exports.up = async function (knex) {
  await knex.schema.alterTable('atproto_identities', table => {
    table.string('plc_url')
    table.string('handle_domain')
  })

  await knex('atproto_identities').update({
    plc_url: normalizePlcUrl(process.env.ATPROTO_PLC_URL) || 'unknown',
    handle_domain: knex.raw("substring(handle from position('.' in handle) + 1)")
  })

  await knex.raw('alter table atproto_identities alter column plc_url set not null')
  await knex.raw('alter table atproto_identities alter column handle_domain set not null')

  await knex.schema.alterTable('atproto_identities', table => {
    table.dropUnique(['user_id'])
    table.unique(['user_id', 'plc_url'])
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('atproto_identities', table => {
    table.dropUnique(['user_id', 'plc_url'])
    table.unique(['user_id'])
    table.dropColumn('plc_url')
    table.dropColumn('handle_domain')
  })
}
