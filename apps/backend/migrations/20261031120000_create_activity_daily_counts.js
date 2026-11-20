/**
 * One row per day, group and dimension for counts that can be summed
 * (posts by type, joins by source, visits by platform). Unique-people
 * metrics stay in metric_snapshots.
 */
exports.up = async function (knex) {
  const exists = await knex.schema.hasTable('activity_daily_counts')
  if (exists) return

  await knex.schema.createTable('activity_daily_counts', table => {
    table.date('day').notNullable()
    table.bigInteger('group_id').notNullable().defaultTo(0)
    table.text('event_type').notNullable()
    table.text('post_type').notNullable().defaultTo('')
    table.text('platform').notNullable().defaultTo('')
    table.text('join_source').notNullable().defaultTo('')
    table.text('is_public').notNullable().defaultTo('')
    table.integer('events').notNullable()
    table.primary(['day', 'group_id', 'event_type', 'post_type', 'platform', 'join_source', 'is_public'])
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('activity_daily_counts')
}
