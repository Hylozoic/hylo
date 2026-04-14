/**
 * Adds home_route column to groups and backfills it from context_widgets
 * so we can redirect to group home without loading context widgets first.
 * home_route is the path segment after /groups/:slug, e.g. /stream, /map, /chat/general
 */

exports.up = async function (knex) {
  await knex.schema.alterTable('groups', table => {
    table.string('home_route', 255)
  })

  // Backfill: set home_route from the first child of the home widget (by order)
  await knex.raw(`
    UPDATE groups g
    SET home_route = sub.path
    FROM (
      SELECT DISTINCT ON (g2.id) g2.id AS group_id,
        CASE
          WHEN cw.view IS NOT NULL AND cw.view != '' THEN '/' || cw.view
          WHEN cw.view_chat_id IS NOT NULL THEN '/chat/' || COALESCE(t.name, 'general')
          WHEN cw.custom_view_id IS NOT NULL THEN '/custom/' || cw.custom_view_id::text
          WHEN cw.view_track_id IS NOT NULL THEN '/tracks/' || cw.view_track_id::text
          WHEN cw.view_funding_round_id IS NOT NULL THEN '/funding-rounds/' || cw.view_funding_round_id::text
          ELSE '/stream'
        END AS path
      FROM groups g2
      JOIN context_widgets home ON home.group_id = g2.id AND home.type = 'home'
      JOIN context_widgets cw ON cw.parent_id = home.id
      LEFT JOIN tags t ON t.id = cw.view_chat_id
      ORDER BY g2.id, cw."order" ASC NULLS LAST
    ) sub
    WHERE g.id = sub.group_id
  `)

  // Groups that have no context widgets (e.g. very old) get default
  await knex('groups')
    .whereNull('home_route')
    .update({ home_route: '/stream' })
}

exports.down = async function (knex) {
  await knex.schema.alterTable('groups', table => {
    table.dropColumn('home_route')
  })
}
