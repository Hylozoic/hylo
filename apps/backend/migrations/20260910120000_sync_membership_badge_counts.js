/**
 * Membership.new_post_count is the space/group menu badge: unread chats plus 1
 * per other on-menu typed view that still has unread (not +1 per post).
 */

exports.up = async function up (knex) {
  await knex.raw(`
    UPDATE group_memberships AS gm
    SET new_post_count = COALESCE(badge.cnt, 0)
    FROM (
      SELECT
        gm2.id,
        COALESCE(SUM(
          CASE WHEN gv.type = 'chat' AND gv."order" IS NOT NULL
            THEN COALESCE(gvu.new_post_count, 0) ELSE 0 END
        ), 0)
        + COUNT(*) FILTER (
            WHERE gv.type IN (
              'discussions', 'events', 'projects', 'proposals',
              'resources', 'requests-and-offers'
            )
              AND gv."order" IS NOT NULL
              AND COALESCE(gvu.new_post_count, 0) > 0
          ) AS cnt
      FROM group_memberships gm2
      LEFT JOIN group_views gv ON gv.group_id = gm2.group_id
      LEFT JOIN group_views_users gvu
        ON gvu.view_id = gv.id AND gvu.user_id = gm2.user_id
      WHERE gm2.active = true
      GROUP BY gm2.id
    ) AS badge
    WHERE gm.id = badge.id
      AND gm.new_post_count IS DISTINCT FROM COALESCE(badge.cnt, 0)
  `)
}

exports.down = async function down () {
  // Previous per-post membership counts cannot be restored.
}
