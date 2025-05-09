exports.up = async function (knex) {
  await knex.schema.alterTable('context_widgets', function (table) {
    table.bigInteger('view_track_id').references('id').inTable('tracks')
  })

  // Delete widgets for viewing posts or groups that are not in the menu anymore
  await knex.raw(`
    DELETE FROM context_widgets
    WHERE (view_post_id IS NOT NULL OR view_group_id IS NOT NULL)
      AND "order" IS NULL;
  `)
}

exports.down = async function (knex) {
  await knex.schema.alterTable('context_widgets', function (table) {
    table.dropColumn('view_track_id')
  })
}
