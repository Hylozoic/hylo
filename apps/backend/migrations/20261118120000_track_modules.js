/**
 * Modules for tracks: an optional grouping level between a track and its actions.
 *
 * - track_modules: one row per module on a track-actions view. `order` is the
 *   module's position among the view's top-level items (modules and actions that
 *   are not in a module share one sequence). settings holds opens_at (a date the
 *   module opens on) and opens_after_previous (opens once the module before it
 *   is finished).
 * - collections_posts.module_id: null means a top-level action. collections_posts
 *   .order stays the flat order of every action in the track, so anything that
 *   reads the list without modules still gets the right sequence.
 * - tracks.module_descriptor(_plural): what this track calls its modules
 *   ("Week", "Unit", ...), like action_descriptor.
 */

exports.up = async function (knex) {
  await knex.schema.createTable('track_modules', table => {
    table.increments().primary()
    table.bigInteger('view_id').notNullable().references('id').inTable('group_views').onDelete('CASCADE')
    table.string('title')
    table.text('description')
    table.integer('order').defaultTo(0)
    table.jsonb('settings').defaultTo('{}')
    table.timestamp('created_at', { useTz: true })
    table.timestamp('updated_at', { useTz: true })
    table.index(['view_id', 'order'], 'idx_track_modules_view_id_order')
  })

  await knex.schema.alterTable('collections_posts', table => {
    table.bigInteger('module_id').references('id').inTable('track_modules').onDelete('SET NULL')
    table.index('module_id', 'idx_collections_posts_module_id')
  })

  await knex.schema.alterTable('tracks', table => {
    table.string('module_descriptor').defaultTo('Module')
    table.string('module_descriptor_plural').defaultTo('Modules')
  })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('tracks', table => {
    table.dropColumn('module_descriptor')
    table.dropColumn('module_descriptor_plural')
  })

  await knex.schema.alterTable('collections_posts', table => {
    table.dropColumn('module_id')
  })

  await knex.schema.dropTable('track_modules')
}
