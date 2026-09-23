/**
 * Drop legacy track and funding-round join tables after content moved onto spaces.
 *
 * - tracks_posts → track-actions view collections_posts
 * - tracks_users → space group_memberships (join = enroll; completedAt in settings)
 * - funding_rounds_posts → space groups_posts (type = submission)
 * - funding_rounds_users → space group_memberships (tokensRemaining in settings)
 *
 * Also drops orphaned trigger functions that still UPDATE tracks_users. Their
 * triggers were removed in 20251110143609. down() does not restore the functions.
 */

exports.up = async function (knex) {
  await knex.raw('DROP FUNCTION IF EXISTS sync_content_access_expires_at()')
  await knex.raw('DROP FUNCTION IF EXISTS clear_content_access_expires_at()')
  await knex.schema.dropTableIfExists('tracks_posts')
  await knex.schema.dropTableIfExists('tracks_users')
  await knex.schema.dropTableIfExists('funding_rounds_posts')
  await knex.schema.dropTableIfExists('funding_rounds_users')
}

exports.down = async function (knex) {
  const hasTracksPosts = await knex.schema.hasTable('tracks_posts')
  if (!hasTracksPosts) {
    await knex.schema.createTable('tracks_posts', table => {
      table.increments().primary()
      table.bigInteger('track_id').references('id').inTable('tracks').notNullable()
      table.bigInteger('post_id').references('id').inTable('posts').notNullable()
      table.integer('sort_order').defaultTo(0)
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
    await knex.raw('alter table tracks_posts alter constraint tracks_posts_track_id_foreign deferrable initially deferred')
    await knex.raw('alter table tracks_posts alter constraint tracks_posts_post_id_foreign deferrable initially deferred')
  }

  const hasTracksUsers = await knex.schema.hasTable('tracks_users')
  if (!hasTracksUsers) {
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
  }

  const hasFundingRoundsPosts = await knex.schema.hasTable('funding_rounds_posts')
  if (!hasFundingRoundsPosts) {
    await knex.schema.createTable('funding_rounds_posts', table => {
      table.increments().primary()
      table.bigInteger('funding_round_id').references('id').inTable('funding_rounds').index().notNullable()
      table.bigInteger('post_id').references('id').inTable('posts').notNullable()
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
    await knex.raw('alter table funding_rounds_posts alter constraint funding_rounds_posts_funding_round_id_foreign deferrable initially deferred')
    await knex.raw('alter table funding_rounds_posts alter constraint funding_rounds_posts_post_id_foreign deferrable initially deferred')
  }

  const hasFundingRoundsUsers = await knex.schema.hasTable('funding_rounds_users')
  if (!hasFundingRoundsUsers) {
    await knex.schema.createTable('funding_rounds_users', table => {
      table.increments().primary()
      table.bigInteger('funding_round_id').references('id').inTable('funding_rounds').index().notNullable()
      table.bigInteger('user_id').references('id').inTable('users').index().notNullable()
      table.jsonb('settings').defaultTo('{ }')
      table.integer('tokens_remaining')
      table.timestamp('created_at')
      table.timestamp('updated_at')
    })
    await knex.raw('alter table funding_rounds_users alter constraint funding_rounds_users_funding_round_id_foreign deferrable initially deferred')
    await knex.raw('alter table funding_rounds_users alter constraint funding_rounds_users_user_id_foreign deferrable initially deferred')
  }
}
