/**
 * Hylo's own record of clicks on links in its emails: the kind of email (the
 * ctt tag the link carries), the person who clicked when they were signed in,
 * and when. Nothing else from the link is kept.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('email_clicks', table => {
    table.bigIncrements('id').primary()
    table.string('email_type', 64).notNullable()
    table.bigInteger('user_id').references('id').inTable('users').onDelete('SET NULL')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.index(['email_type', 'created_at'])
    table.index(['user_id'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('email_clicks')
}
