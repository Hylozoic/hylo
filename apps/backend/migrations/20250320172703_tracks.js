exports.up = async function (knex) {
  await knex.schema.createTable('tracks', table => {
    table.increments().primary()
    table.string('name').notNullable()
    table.text('description')
    table.text('banner_url')
    table.string('actions_name')
    table.text('welcome_message')
    table.text('completion_message')
    table.string('completion_badge_name')
    table.string('completion_badge_emoji')
    table.timestamp('deactivated_at')
    table.timestamp('published_at')
    table.timestamp('created_at')
    table.timestamp('updated_at')
    table.jsonb('settings').defaultTo('{ }')
    table.integer('num_actions').defaultTo(0)
    table.integer('num_people_enrolled').defaultTo(0)
    table.integer('num_people_completed').defaultTo(0)
  })

  await knex.schema.createTable('groups_tracks', table => {
    table.increments().primary()
    table.bigInteger('track_id').references('id').inTable('tracks').notNullable()
    table.bigInteger('group_id').references('id').inTable('groups').index().notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table groups_tracks alter constraint groups_tracks_track_id_foreign deferrable initially deferred')
  await knex.raw('alter table groups_tracks alter constraint groups_tracks_group_id_foreign deferrable initially deferred')

  await knex.schema.createTable('tracks_posts', table => {
    table.increments().primary()
    table.bigInteger('track_id').references('id').inTable('tracks').index().notNullable()
    table.bigInteger('post_id').references('id').inTable('posts').notNullable()
    table.integer('order')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table tracks_posts alter constraint tracks_posts_track_id_foreign deferrable initially deferred')
  await knex.raw('alter table tracks_posts alter constraint tracks_posts_post_id_foreign deferrable initially deferred')

  await knex.schema.createTable('tracks_users', table => {
    table.increments().primary()
    table.bigInteger('track_id').references('id').inTable('tracks').index().notNullable()
    table.bigInteger('user_id').references('id').inTable('users').index().notNullable()
    table.jsonb('settings').defaultTo('{ }')
    table.timestamp('enrolled_at')
    table.timestamp('completed_at')
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('alter table tracks_users alter constraint tracks_users_track_id_foreign deferrable initially deferred')
  await knex.raw('alter table tracks_users alter constraint tracks_users_user_id_foreign deferrable initially deferred')

  await knex.schema.alterTable('posts', table => {
    table.string('completion_action')
    table.jsonb('completion_action_settings').defaultTo('{}')
    table.integer('num_people_completed').defaultTo(0)
  })

  await knex.schema.alterTable('posts_users', table => {
    table.timestamp('completed_at')
    table.jsonb('completion_response').defaultTo('[]')
  })
}

exports.down = async function (knex) {
  await knex.schema.dropTable('groups_tracks')
  await knex.schema.dropTable('tracks_posts')
  await knex.schema.dropTable('tracks_users')
  await knex.schema.dropTable('tracks')

  await knex.schema.alterTable('posts', table => {
    table.dropColumn('completion_action')
    table.dropColumn('completion_action_settings')
    table.dropColumn('num_people_completed')
  })

  await knex.schema.alterTable('posts_users', table => {
    table.dropColumn('completed_at')
    table.dropColumn('completion_response')
  })
}
