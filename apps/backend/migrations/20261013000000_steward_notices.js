/**
 * Steward notices (D14, D49).
 *
 * join_requests.unanswered_notified_at: when the person who asked to join was told
 * their request has had no answer for 14 days, so they are told once.
 *
 * first_post_nudges: newcomers' first posts that had no comment or reaction after a
 * day, one row per post and group, with the newcomer's experiment arm and how many
 * stewards the group had to tell (steward_count, in both arms, so the analysis can
 * compare like with like). Treatment rows with stewards have nudged_at set (they got
 * an in-app nudge and the post is listed in the weekly steward email); control rows
 * are kept for the analysis.
 *
 * group_notice_marks: when a group last had one of the scheduled steward notices
 * (kind: newcomer_notice, steward_digest or quiet_prompt), so each goes out at most
 * once per period. Kept out of groups.settings, which a stale Group#save can overwrite.
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
    table.integer('steward_count')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['post_id', 'group_id'])
    table.index(['group_id', 'created_at'])
  })

  await knex.schema.createTable('group_notice_marks', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('kind', 64).notNullable()
    table.timestamp('sent_at', { useTz: true }).notNullable()
    table.unique(['group_id', 'kind'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('group_notice_marks')
  await knex.schema.dropTableIfExists('first_post_nudges')
  await knex.schema.alterTable('join_requests', table => {
    table.dropColumn('unanswered_notified_at')
  })
}
