/**
 * First-party analytics primitives (see the platform analytics plan).
 *
 * activity_days: one row per user, per group, per UTC day they were active.
 *   group_id 0 means anywhere on Hylo (not tied to a group).
 * activity_events: append-only log of what people did. group_id 0 means the
 *   action isn't group-scoped (signup, direct messages).
 *
 * Neither table has a foreign key, so writes never lock users or groups.
 * Rows for a deleted user are removed by User.sanelyDeleteUser.
 * Idempotent, so it can be re-run safely.
 */

exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('activity_days'))) {
    await knex.schema.createTable('activity_days', table => {
      table.date('day').notNullable()
      table.bigInteger('group_id').notNullable().defaultTo(0)
      table.bigInteger('user_id').notNullable()
      table.text('platform').notNullable().defaultTo('unknown')
      table.primary(['day', 'group_id', 'user_id'])
      table.index(['user_id', 'day'])
    })
  }

  if (!(await knex.schema.hasTable('activity_events'))) {
    await knex.schema.createTable('activity_events', table => {
      table.bigIncrements('id')
      table.timestamp('occurred_at', { useTz: true }).notNullable()
      table.text('event_type').notNullable()
      table.bigInteger('user_id').notNullable()
      table.bigInteger('group_id').notNullable().defaultTo(0)
      table.text('object_type')
      table.bigInteger('object_id')
      table.bigInteger('target_user_id')
      table.text('post_type')
      table.text('platform')
      table.jsonb('properties')
      table.text('source').notNullable().defaultTo('live')
      table.index(['group_id', 'occurred_at'])
      table.index(['occurred_at', 'event_type'])
      table.index(['user_id', 'occurred_at'])
    })
    // Lets repeated inserts and re-run backfills be no-ops. object_id is null
    // for events without an object, and nulls never collide, so those always insert.
    await knex.raw('create unique index activity_events_dedupe_index on activity_events (event_type, object_id, user_id, group_id)')
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('activity_events')
  await knex.schema.dropTableIfExists('activity_days')
}
