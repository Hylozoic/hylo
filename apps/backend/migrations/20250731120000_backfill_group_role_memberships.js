exports.up = async function (knex) {
  await knex.raw(`
    INSERT INTO group_memberships_group_roles (group_id, group_role_id, user_id, active, created_at, updated_at)
    SELECT gr.group_id,
           gru.group_role_id,
           gru.user_id,
           TRUE,
           COALESCE(gru.created_at, NOW()),
           NOW()
    FROM group_roles_users AS gru
    JOIN groups_roles AS gr ON gr.id = gru.group_role_id
    LEFT JOIN group_memberships_group_roles AS gmgr
      ON gmgr.group_role_id = gru.group_role_id
     AND gmgr.user_id = gru.user_id
     AND gmgr.group_id = gr.group_id
    WHERE gmgr.id IS NULL;
  `)
}

exports.down = async function (knex) {
  await knex.raw(`
    DELETE FROM group_memberships_group_roles AS gmgr
    USING group_roles_users AS gru, groups_roles AS gr
    WHERE gmgr.group_role_id = gru.group_role_id
      AND gmgr.user_id = gru.user_id
      AND gmgr.group_id = gr.group_id;
  `)
}
