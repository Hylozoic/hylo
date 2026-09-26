/**
 * One row per user per UTC day on which they made an authenticated request.
 * users.last_active_at keeps only the latest visit, so this is what makes
 * daily, weekly and monthly active-user trends possible. Rows older than 2
 * years are pruned daily.
 *
 * Idempotent, so switching between branches that do and don't include this
 * migration can't fail on an existing table.
 */

exports.up = async function (knex) {
  if (await knex.schema.hasTable('user_activity_days')) return
  // The foreign key locks users, which every signed-in request updates, so give up
  // quickly instead of queueing traffic behind a long-running transaction.
  await knex.raw("set local lock_timeout = '5s'")
  await knex.schema.createTable('user_activity_days', table => {
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.date('day').notNullable()
    table.primary(['user_id', 'day'])
    table.index(['day'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('user_activity_days')
}
