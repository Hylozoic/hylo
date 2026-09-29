/**
 * Steward notices (D14, D49).
 *
 * join_requests.unanswered_notified_at: when the person who asked to join was told
 * their request has had no answer for 14 days, so they are told once.
 *
 * first_post_nudges: newcomers' first posts that had no comment or reaction after a
 * day, one row per post and group, with the newcomer's experiment arm. Treatment rows
 * have nudged_at set (Moderators and Hosts got an in-app nudge and the post is listed
 * in the weekly steward email); control rows are kept for the analysis.
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('join_requests', table => {
    table.timestamp('unanswered_notified_at', { useTz: true })
  })

  await knex.schema.createTable('first_post_nudges', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('post_id').notNullable().references('id').inTable('posts').onDelete('CASCADE')
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.string('variant', 64).notNullable()
    table.timestamp('nudged_at', { useTz: true })
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['post_id', 'group_id'])
    table.index(['group_id', 'created_at'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('first_post_nudges')
  await knex.schema.alterTable('join_requests', table => {
    table.dropColumn('unanswered_notified_at')
  })
}
