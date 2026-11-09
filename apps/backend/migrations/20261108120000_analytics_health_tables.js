/**
 * Tables the health metrics read, plus the post an activity belongs to and
 * events recorded before someone has an account.
 * Idempotent, so it can be re-run safely.
 */

exports.up = async function (knex) {
  if (await knex.schema.hasTable('activity_events') && !(await knex.schema.hasColumn('activity_events', 'post_id'))) {
    await knex.schema.alterTable('activity_events', table => {
      table.bigInteger('post_id')
      table.index(['post_id'])
    })
  }

  if (await knex.schema.hasTable('metric_snapshots') && !(await knex.schema.hasColumn('metric_snapshots', 'definition_version'))) {
    await knex.schema.alterTable('metric_snapshots', table => {
      table.integer('definition_version').notNullable().defaultTo(1)
    })
  }

  if (await knex.schema.hasTable('users') && !(await knex.schema.hasColumn('users', 'analytics_anonymous_id'))) {
    await knex.schema.alterTable('users', table => {
      table.text('analytics_anonymous_id')
    })
    await knex.raw('create unique index users_analytics_anonymous_id_index on users (analytics_anonymous_id) where analytics_anonymous_id is not null')
  }

  if (!(await knex.schema.hasTable('anonymous_events'))) {
    await knex.schema.createTable('anonymous_events', table => {
      table.bigIncrements('id')
      table.text('anonymous_id').notNullable()
      table.text('event_type').notNullable()
      table.timestamp('occurred_at', { useTz: true }).notNullable()
      table.text('platform')
      table.jsonb('properties')
      table.bigInteger('user_id')
      table.timestamp('linked_at', { useTz: true })
      table.index(['anonymous_id', 'occurred_at'])
    })
  }

  if (!(await knex.schema.hasTable('user_day_activity'))) {
    await knex.schema.createTable('user_day_activity', table => {
      table.date('day').notNullable()
      table.bigInteger('group_id').notNullable()
      table.bigInteger('user_id').notNullable()
      table.integer('posts').notNullable().defaultTo(0)
      table.integer('comments').notNullable().defaultTo(0)
      table.integer('reactions').notNullable().defaultTo(0)
      table.integer('rsvps').notNullable().defaultTo(0)
      table.integer('votes').notNullable().defaultTo(0)
      table.integer('project_joins').notNullable().defaultTo(0)
      table.integer('invites_sent').notNullable().defaultTo(0)
      table.integer('connections').notNullable().defaultTo(0)
      table.integer('received_connections').notNullable().defaultTo(0)
      table.integer('connections_beyond_reaction').notNullable().defaultTo(0)
      table.integer('received_beyond_reaction').notNullable().defaultTo(0)
      table.integer('coordinating').notNullable().defaultTo(0)
      table.integer('received_coordinating').notNullable().defaultTo(0)
      table.primary(['day', 'group_id', 'user_id'])
      table.index(['user_id', 'day'])
      table.index(['group_id', 'day'])
    })
  }

  if (!(await knex.schema.hasTable('user_milestones'))) {
    await knex.schema.createTable('user_milestones', table => {
      table.bigInteger('user_id').notNullable()
      table.text('milestone').notNullable()
      table.bigInteger('group_id').notNullable().defaultTo(0)
      table.date('occurred_on').notNullable()
      table.primary(['user_id', 'milestone', 'group_id'])
      table.index(['milestone', 'occurred_on'])
    })
  }

  if (!(await knex.schema.hasTable('group_activity_weeks'))) {
    await knex.schema.createTable('group_activity_weeks', table => {
      table.bigInteger('group_id').notNullable()
      table.date('week_start').notNullable()
      table.integer('voices_28d').notNullable().defaultTo(0)
      table.integer('connections_28d').notNullable().defaultTo(0)
      table.primary(['group_id', 'week_start'])
    })
  }

  if (!(await knex.schema.hasTable('post_outcomes'))) {
    await knex.schema.createTable('post_outcomes', table => {
      table.bigInteger('post_id').notNullable()
      table.bigInteger('group_id').notNullable()
      table.bigInteger('author_id').notNullable()
      table.text('post_type')
      table.timestamp('created_at', { useTz: true }).notNullable()
      table.boolean('is_first_post').notNullable().defaultTo(false)
      table.boolean('author_newcomer').notNullable().defaultTo(false)
      table.decimal('first_response_hours', 12, 2)
      table.decimal('first_comment_hours', 12, 2)
      table.integer('responder_count').notNullable().defaultTo(0)
      table.boolean('chat_reply_24h').notNullable().defaultTo(false)
      table.timestamp('event_start', { useTz: true })
      table.integer('other_rsvps').notNullable().defaultTo(0)
      table.text('proposal_status')
      table.timestamp('voting_end', { useTz: true })
      table.integer('voter_count').notNullable().defaultTo(0)
      table.integer('project_self_joins').notNullable().defaultTo(0)
      table.integer('project_author_adds').notNullable().defaultTo(0)
      table.boolean('group_was_live').notNullable().defaultTo(false)
      table.timestamp('refreshed_at', { useTz: true }).notNullable()
      table.primary(['post_id', 'group_id'])
      table.index(['created_at'])
      table.index(['group_id', 'created_at'])
    })
  }

  if (!(await knex.schema.hasTable('retention_cache'))) {
    await knex.schema.createTable('retention_cache', table => {
      table.text('cache_key').primary()
      table.jsonb('result').notNullable()
      table.timestamp('computed_at', { useTz: true }).notNullable()
    })
  }
}

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('retention_cache')
  await knex.schema.dropTableIfExists('post_outcomes')
  await knex.schema.dropTableIfExists('group_activity_weeks')
  await knex.schema.dropTableIfExists('user_milestones')
  await knex.schema.dropTableIfExists('user_day_activity')
  await knex.schema.dropTableIfExists('anonymous_events')
  if (await knex.schema.hasColumn('users', 'analytics_anonymous_id')) {
    await knex.raw('drop index if exists users_analytics_anonymous_id_index')
    await knex.schema.alterTable('users', table => table.dropColumn('analytics_anonymous_id'))
  }
  if (await knex.schema.hasColumn('metric_snapshots', 'definition_version')) {
    await knex.schema.alterTable('metric_snapshots', table => table.dropColumn('definition_version'))
  }
  if (await knex.schema.hasColumn('activity_events', 'post_id')) {
    await knex.schema.alterTable('activity_events', table => table.dropColumn('post_id'))
  }
}
