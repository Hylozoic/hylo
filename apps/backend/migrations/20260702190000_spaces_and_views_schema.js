// Spaces & Views — Phase 1, Step 1: additive schema changes only.
// See docs/spaces-and-views-engineering-spec.md section 2.
// This migration only adds columns/tables — it does not touch or drop any
// existing columns/tables (Track/FundingRound column removal + the
// ContextWidget -> GroupView data migration are handled separately).

exports.up = async function (knex) {
  await knex.schema.table('groups', table => {
    table.bigInteger('parent_id').references('id').inTable('groups').onDelete('CASCADE')
    table.jsonb('accepted_post_types')
    table.jsonb('required_roles')
    table.string('icon')
    table.bigInteger('track_id').references('id').inTable('tracks').onDelete('SET NULL')
    table.bigInteger('funding_round_id').references('id').inTable('funding_rounds').onDelete('SET NULL')
  })

  // Deferrable so multi-step operations within a single transaction (e.g. the
  // data migration, or bulk reorder-style updates) aren't blocked by FK checks
  // before the transaction commits — matches the convention used throughout
  // this codebase for every other foreign key (see context_widgets, collections).
  await knex.raw('alter table groups alter constraint groups_parent_id_foreign deferrable initially deferred')
  await knex.raw('alter table groups alter constraint groups_track_id_foreign deferrable initially deferred')
  await knex.raw('alter table groups alter constraint groups_funding_round_id_foreign deferrable initially deferred')

  await knex.schema.raw('CREATE INDEX idx_groups_parent_id ON groups(parent_id)')
  await knex.schema.raw('CREATE INDEX idx_groups_parent_id_type ON groups(parent_id, type)')
  await knex.schema.raw('CREATE INDEX idx_groups_track_id ON groups(track_id)')
  await knex.schema.raw('CREATE INDEX idx_groups_funding_round_id ON groups(funding_round_id)')

  await knex.schema.table('tracks', table => {
    table.bigInteger('group_id').references('id').inTable('groups').onDelete('SET NULL')
  })
  await knex.raw('alter table tracks alter constraint tracks_group_id_foreign deferrable initially deferred')
  await knex.schema.raw('CREATE INDEX idx_tracks_group_id ON tracks(group_id)')

  await knex.schema.createTable('group_views', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('group_id').notNullable().references('id').inTable('groups').onDelete('CASCADE')
    table.string('name')
    table.string('type').notNullable()
    table.integer('order')
    table.string('icon')
    table.text('page_content')
    table.text('link')
    table.bigInteger('post_id').references('id').inTable('posts').onDelete('CASCADE')
    table.bigInteger('user_id').references('id').inTable('users').onDelete('CASCADE')
    table.bigInteger('linked_group_id').references('id').inTable('groups').onDelete('CASCADE')
    table.jsonb('topics').notNullable().defaultTo(knex.raw("'[]'::jsonb"))
    table.jsonb('settings')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
  })
  await knex.raw('alter table group_views alter constraint group_views_group_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_views alter constraint group_views_post_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_views alter constraint group_views_user_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_views alter constraint group_views_linked_group_id_foreign deferrable initially deferred')
  await knex.schema.raw('CREATE INDEX idx_group_views_group_order ON group_views(group_id, "order")')

  await knex.schema.createTable('group_views_users', table => {
    table.bigIncrements('id').primary()
    table.bigInteger('view_id').notNullable().references('id').inTable('group_views').onDelete('CASCADE')
    table.bigInteger('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
    table.integer('new_post_count').notNullable().defaultTo(0)
    table.bigInteger('last_read_post_id').references('id').inTable('posts').onDelete('SET NULL')
    table.jsonb('settings')
    table.timestamp('created_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.timestamp('updated_at', { useTz: true }).notNullable().defaultTo(knex.fn.now())
    table.unique(['view_id', 'user_id'])
  })
  await knex.raw('alter table group_views_users alter constraint group_views_users_view_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_views_users alter constraint group_views_users_user_id_foreign deferrable initially deferred')
  await knex.raw('alter table group_views_users alter constraint group_views_users_last_read_post_id_foreign deferrable initially deferred')
  await knex.schema.raw('CREATE INDEX idx_gvu_view_id ON group_views_users(view_id)')
  await knex.schema.raw('CREATE INDEX idx_gvu_user_id ON group_views_users(user_id)')

  // Re-use collections_posts for view post ordering (collection_id retired in a later migration)
  await knex.schema.table('collections_posts', table => {
    table.bigInteger('view_id').references('id').inTable('group_views').onDelete('CASCADE')
  })
  await knex.raw('ALTER TABLE collections_posts ALTER COLUMN collection_id DROP NOT NULL')
  await knex.raw('alter table collections_posts alter constraint collections_posts_view_id_foreign deferrable initially deferred')
  await knex.schema.raw('CREATE INDEX idx_collections_posts_view_id ON collections_posts(view_id)')
  await knex.schema.raw(
    'CREATE UNIQUE INDEX idx_collections_posts_view_post ON collections_posts(view_id, post_id) WHERE view_id IS NOT NULL'
  )
}

exports.down = async function (knex) {
  console.log('[down schema] 1/3 dropping group_views tables…')
  await knex.schema.raw('DROP INDEX IF EXISTS idx_collections_posts_view_post')
  await knex.schema.table('collections_posts', table => {
    table.dropColumn('view_id')
  })
  await knex.schema.dropTableIfExists('group_views_users')
  await knex.schema.dropTableIfExists('group_views')

  console.log('[down schema] 2/3 dropping tracks.group_id…')
  await knex.schema.table('tracks', table => {
    table.dropColumn('group_id')
  })

  console.log('[down schema] 3/3 dropping groups columns (can take several minutes on large DBs)…')
  await knex.schema.table('groups', table => {
    table.dropColumn('parent_id')
    table.dropColumn('accepted_post_types')
    table.dropColumn('required_roles')
    table.dropColumn('icon')
    table.dropColumn('track_id')
    table.dropColumn('funding_round_id')
  })
  console.log('[down schema] done.')
}
