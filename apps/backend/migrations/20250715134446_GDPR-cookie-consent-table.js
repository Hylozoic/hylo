exports.up = function (knex) {
  return knex.raw('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"')
    .then(() => {
      return knex.schema.createTable('cookie_consents', function (table) {
        table.increments('id').primary()
        table.uuid('consent_id').unique().notNullable()
        table.bigInteger('user_id').references('id').inTable('users').nullable()
        table.jsonb('settings').defaultTo('{}')
        table.text('version')
        table.timestamp('created_at').defaultTo(knex.fn.now())
        table.timestamp('updated_at').defaultTo(knex.fn.now())
        table.text('ip_address')
        table.text('user_agent')

        table.index('user_id')
        table.index('consent_id')
      })
    })
}

exports.down = function (knex) {
  return knex.schema.dropTable('cookie_consents')
}
