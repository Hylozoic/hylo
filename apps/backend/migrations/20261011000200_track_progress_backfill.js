/**
 * D63: a learner's progress in a track now lives on their track-space membership
 * (settings.actionsCompleted and settings.lastActionAt), written each time they
 * complete an action. This fills them in for active enrollments from before, from the
 * actions they have already completed, so stewards see their progress and idle
 * reminders measure from their real last action.
 *
 * Only memberships without actionsCompleted are touched, so it is safe to run again.
 * down() leaves the values alone: they stay correct and later completions update them.
 */

exports.up = async function (knex) {
  await knex.raw(`
    WITH progress AS (
      SELECT
        gm.id AS membership_id,
        COUNT(pu.id) AS completed,
        MAX(pu.completed_at) AS last_action_at
      FROM group_memberships gm
      JOIN groups g ON g.id = gm.group_id AND g.track_id IS NOT NULL
      JOIN group_views gv ON gv.group_id = g.id AND gv.type = 'track-actions'
      JOIN collections_posts cp ON cp.view_id = gv.id
      JOIN posts p ON p.id = cp.post_id AND p.active = true AND p.type = 'action'
      LEFT JOIN posts_users pu ON pu.post_id = p.id AND pu.user_id = gm.user_id AND pu.completed_at IS NOT NULL
      WHERE gm.active = true
        AND COALESCE(gm.settings, '{}'::jsonb) -> 'actionsCompleted' IS NULL
      GROUP BY gm.id
    )
    UPDATE group_memberships gm
    SET settings = COALESCE(gm.settings, '{}'::jsonb)
      || jsonb_build_object('actionsCompleted', progress.completed)
      || CASE
        WHEN progress.last_action_at IS NULL THEN '{}'::jsonb
        ELSE jsonb_build_object('lastActionAt', to_char(progress.last_action_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))
      END
    FROM progress
    WHERE gm.id = progress.membership_id
  `)
}

exports.down = async function () {}
