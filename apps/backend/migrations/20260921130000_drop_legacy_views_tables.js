/**
 * Drop leftover ContextWidget / CustomView / Collection / groups_tracks tables
 * after the spaces-and-views refactor, and add indexes matching current query shapes.
 *
 * Also:
 * - drop collections_posts.collection_id and require view_id
 * - drop left-prefix duplicate indexes
 */

exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('context_widgets')
  await knex.schema.dropTableIfExists('custom_view_topics')
  await knex.schema.dropTableIfExists('custom_views')

  await knex('collections_posts').whereNull('view_id').del()

  const hasCollectionId = await knex.schema.hasColumn('collections_posts', 'collection_id')
  if (hasCollectionId) {
    await knex.schema.table('collections_posts', table => {
      table.dropColumn('collection_id')
    })
  }

  await knex.raw('ALTER TABLE collections_posts ALTER COLUMN view_id SET NOT NULL')

  await knex.schema.dropTableIfExists('collections')
  await knex.schema.dropTableIfExists('groups_tracks')

  await knex.raw('DROP INDEX IF EXISTS idx_gvu_view_id')
  await knex.raw('DROP INDEX IF EXISTS idx_collections_posts_view_id')
  await knex.raw('DROP INDEX IF EXISTS idx_groups_parent_id')

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_collections_posts_view_id_order
    ON collections_posts (view_id, "order")
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_gvu_user_id_view_id
    ON group_views_users (user_id, view_id)
    INCLUDE (new_post_count, last_read_post_id)
  `)
  await knex.raw(`
    CREATE INDEX IF NOT EXISTS idx_gvu_updated_at_unread
    ON group_views_users (updated_at)
    WHERE new_post_count > 0
  `)
}

exports.down = async function (knex) {
  await knex.raw('DROP INDEX IF EXISTS idx_gvu_updated_at_unread')
  await knex.raw('DROP INDEX IF EXISTS idx_gvu_user_id_view_id')
  await knex.raw('DROP INDEX IF EXISTS idx_collections_posts_view_id_order')

  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_gvu_view_id ON group_views_users(view_id)')
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_collections_posts_view_id ON collections_posts(view_id)')
  await knex.schema.raw('CREATE INDEX IF NOT EXISTS idx_groups_parent_id ON groups(parent_id)')

  await knex.schema.createTable('groups_tracks', table => {
    table.increments().primary()
    table.bigInteger('group_id').references('id').inTable('groups').notNullable()
    table.bigInteger('track_id').references('id').inTable('tracks').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.schema.createTable('collections', table => {
    table.increments().primary()
    table.bigInteger('user_id').references('id').inTable('users')
    table.bigInteger('group_id').references('id').inTable('groups')
    table.boolean('is_active').defaultTo(true)
    table.string('name').notNullable()
    table.timestamp('created_at')
    table.timestamp('updated_at')
  })

  await knex.raw('ALTER TABLE collections_posts ALTER COLUMN view_id DROP NOT NULL')
  await knex.schema.table('collections_posts', table => {
    table.bigInteger('collection_id').references('id').inTable('collections')
  })
}
