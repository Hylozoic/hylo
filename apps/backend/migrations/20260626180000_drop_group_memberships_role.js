/**
 * Drop legacy role columns superseded by group_memberships_group_roles and groups_roles.
 */

const LEGACY_MODERATOR_ROLE = 1

exports.up = async function (knex) {
  if (await knex.schema.hasColumn('group_memberships', 'role')) {
    await knex.schema.alterTable('group_memberships', table => {
      table.dropColumn('role')
    })
  }

  if (await knex.schema.hasColumn('group_invites', 'role')) {
    await knex.schema.alterTable('group_invites', table => {
      table.dropColumn('role')
    })
  }

  // completion_role_id now always references groups_roles (migrated in prior migration)
  if (await knex.schema.hasColumn('tracks', 'completion_role_type')) {
    await knex.schema.alterTable('tracks', table => {
      table.dropColumn('completion_role_type')
    })
  }
}

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn('group_memberships', 'role'))) {
    await knex.schema.alterTable('group_memberships', table => {
      table.integer('role').defaultTo(0)
    })
  }

  if (!(await knex.schema.hasColumn('group_invites', 'role'))) {
    await knex.schema.alterTable('group_invites', table => {
      table.integer('role').defaultTo(0)
    })
  }

  if (!(await knex.schema.hasColumn('tracks', 'completion_role_type'))) {
    await knex.schema.alterTable('tracks', table => {
      table.string('completion_role_type').defaultTo('group')
    })
  }

  const hasSystemRoles = await knex.schema.hasColumn('groups_roles', 'type')
  if (!hasSystemRoles) return

  // Legacy role=1 (moderator/coordinator) for members with a Coordinator system role
  await knex.raw(`
    UPDATE group_memberships gm
    SET role = ?
    FROM group_memberships_group_roles mgr
    JOIN groups_roles gr ON gr.id = mgr.group_role_id
    WHERE mgr.user_id = gm.user_id
      AND mgr.group_id = gm.group_id
      AND gr.type = 'system'
      AND gr.name = 'Coordinator'
  `, [LEGACY_MODERATOR_ROLE])

  if (await knex.schema.hasColumn('tracks', 'completion_role_type')) {
    await knex.raw(`
      UPDATE tracks t
      SET completion_role_type = 'common'
      FROM groups_roles gr
      WHERE t.completion_role_id = gr.id
        AND gr.type = 'system'
    `)
  }
}
