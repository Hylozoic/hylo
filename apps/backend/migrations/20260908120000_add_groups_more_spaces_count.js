/**
 * Cached count of child spaces that are not on the group menu (no group_views
 * row with type=space and order set). Same idea as menu_view_count: the parent
 * menu can show More Spaces and its badge without loading the spaces list.
 */

exports.up = async function up (knex) {
  await knex.schema.alterTable('groups', table => {
    table.integer('more_spaces_count').notNullable().defaultTo(0)
  })

  await knex.raw(`
    UPDATE groups
    SET more_spaces_count = sub.space_count
    FROM (
      SELECT spaces.parent_id AS group_id, count(*)::int AS space_count
      FROM groups spaces
      WHERE spaces.type = 'space'
        AND spaces.active = true
        AND spaces.parent_id IS NOT NULL
        AND NOT EXISTS (
          SELECT 1
          FROM group_views gv
          WHERE gv.group_id = spaces.parent_id
            AND gv.type = 'space'
            AND gv.order IS NOT NULL
            AND gv.linked_group_id = spaces.id
        )
      GROUP BY spaces.parent_id
    ) sub
    WHERE groups.id = sub.group_id
  `)
}

exports.down = async function down (knex) {
  await knex.schema.alterTable('groups', table => {
    table.dropColumn('more_spaces_count')
  })
}
