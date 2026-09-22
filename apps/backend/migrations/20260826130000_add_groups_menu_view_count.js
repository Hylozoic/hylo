/**
 * Cached on-menu view count (group_views.order is not null), same idea as
 * home_route: the parent menu can tell single-view vs multi-view spaces
 * without loading nested views.
 */

exports.up = async function up (knex) {
  await knex.schema.alterTable('groups', table => {
    table.integer('menu_view_count').notNullable().defaultTo(0)
  })

  await knex.raw(`
    UPDATE groups
    SET menu_view_count = sub.view_count
    FROM (
      SELECT group_id, count(*)::int AS view_count
      FROM group_views
      WHERE "order" IS NOT NULL
      GROUP BY group_id
    ) sub
    WHERE groups.id = sub.group_id
  `)
}

exports.down = async function down (knex) {
  await knex.schema.alterTable('groups', table => {
    table.dropColumn('menu_view_count')
  })
}
