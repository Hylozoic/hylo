/**
 * Backfill groups.num_members.
 *
 * The space-creation path never set the column, so spaces were born NULL —
 * rendered as 0 members — and the join-path increment (NULL + 1 = NULL) could
 * never repair it. Only the ten-minute recompute cron fixes such rows, and it
 * does not run in local dev at all.
 *
 * This is the cron's own statement (Group.updateAllMemberCounts), run once so
 * every environment starts from true counts; the model now coalesces its
 * increments and createSpace seeds the column, so counts stay right after this.
 */
exports.up = async function (knex) {
  await knex.raw(`
    UPDATE groups SET num_members = (
      SELECT count(group_memberships.*)
      FROM group_memberships
      INNER JOIN users ON users.id = group_memberships.user_id
      WHERE group_memberships.active = true
        AND users.active = true
        AND group_memberships.group_id = groups.id
    )
  `)
}

// A recompute of derived data has nothing meaningful to restore
exports.down = async function () {}
