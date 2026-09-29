/**
 * Where each new account first came from: the referring site's host name,
 * short utm source, medium and campaign tags, or 'invite' / 'sandbox_demo'.
 * Set once, when the user row is created (see lib/acquisitionSource.js).
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('users', table => {
    table.jsonb('acquisition_source')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('users', table => {
    table.dropColumn('acquisition_source')
  })
}
