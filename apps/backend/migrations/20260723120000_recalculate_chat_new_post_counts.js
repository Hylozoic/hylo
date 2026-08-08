/**
 * Recalculate group_views_users unread for chat views; reset all other views.
 *
 * - chat: recount new_post_count from chat-visible posts after last_read_post_id
 * - every other view: new_post_count = 0, last_read_post_id = latest post in the group
 *   (frontend treats that as fully read; typed badges start clean and rebuild from
 *   live increments going forward)
 */

exports.up = async function (knex) {
  // Chat views — accurate unread from last_read_post_id
  await knex.raw(`
    UPDATE group_views_users AS gvu
    SET
      new_post_count = sub.cnt,
      updated_at = NOW()
    FROM (
      SELECT
        gvu2.id AS gvu_id,
        COUNT(p.id)::int AS cnt
      FROM group_views_users gvu2
      INNER JOIN group_views gv
        ON gv.id = gvu2.view_id
       AND gv.type = 'chat'
      LEFT JOIN groups_posts gp
        ON gp.group_id = gv.group_id
      LEFT JOIN posts p
        ON p.id = gp.post_id
       AND p.deactivated_at IS NULL
       AND p.type IN (
         'chat', 'discussion', 'request', 'offer',
         'project', 'proposal', 'event', 'resource'
       )
       AND (gvu2.last_read_post_id IS NULL OR p.id > gvu2.last_read_post_id)
      GROUP BY gvu2.id
    ) AS sub
    WHERE gvu.id = sub.gvu_id
      AND gvu.new_post_count IS DISTINCT FROM sub.cnt
  `)

  // All non-chat views — fully read at the group's latest post
  await knex.raw(`
    UPDATE group_views_users AS gvu
    SET
      new_post_count = 0,
      last_read_post_id = latest.max_post_id,
      updated_at = NOW()
    FROM group_views gv
    LEFT JOIN LATERAL (
      SELECT MAX(gp.post_id) AS max_post_id
      FROM groups_posts gp
      WHERE gp.group_id = gv.group_id
    ) AS latest ON true
    WHERE gvu.view_id = gv.id
      AND gv.type <> 'chat'
      AND (
        gvu.new_post_count <> 0
        OR gvu.last_read_post_id IS DISTINCT FROM latest.max_post_id
      )
  `)
}

exports.down = async function () {
  // Irreversible data correction — prior counts were known-bad after spaces migration.
}
