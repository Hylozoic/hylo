exports.up = async function (knex) {
  await knex.raw(`
    UPDATE groups_roles
    SET threshold_required = 0.51
    WHERE threshold_required IS NULL
       OR threshold_required <= 0;
  `)

  await knex.raw(`
    UPDATE groups_roles AS gr
    SET threshold_required = LEAST(gr.threshold_required / NULLIF(mc.member_count, 0), 1)
    FROM (
      SELECT gr_inner.id AS role_id,
             gr_inner.group_id,
             GREATEST(COUNT(DISTINCT gm.user_id), 1) AS member_count
      FROM groups_roles gr_inner
      LEFT JOIN group_memberships gm ON gm.group_id = gr_inner.group_id AND gm.active = TRUE
      GROUP BY gr_inner.id, gr_inner.group_id
    ) AS mc
    WHERE gr.id = mc.role_id
      AND gr.threshold_required > 1;
  `)

  await knex.raw(`
    UPDATE groups_roles
    SET threshold_required = 0.51
    WHERE threshold_required IS NULL
       OR threshold_required <= 0;
  `)
}

exports.down = async function () {
  // no-op; previous threshold values cannot be reliably restored
}
