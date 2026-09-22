/**
 * Space menu labels read group_views.name. Create/update now write that
 * column, but existing type=space rows were left null or stale while the
 * Group name moved. Copy the current space Group name onto those views.
 */
exports.up = async function (knex) {
  await knex.raw(`
    UPDATE group_views gv
    SET name = g.name, updated_at = NOW()
    FROM groups g
    WHERE gv.type = 'space'
      AND gv.linked_group_id = g.id
      AND gv.name IS DISTINCT FROM g.name
  `)
}

exports.down = async function () {}
