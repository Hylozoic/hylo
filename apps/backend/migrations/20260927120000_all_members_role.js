/**
 * Give every top-level group an implicit All Members role (type 'all_members').
 *
 * Nobody is assigned this role. The view group_member_effective_roles treats
 * every active member as holding it, so a responsibility linked to it applies
 * to the whole group. This migration links nothing, so no group's behaviour
 * changes until an Administrator changes its invite policy.
 */

const ADD_MEMBERS = 'Add Members'
const ADD_MEMBERS_DESCRIPTION = 'Invite and add new people, and accept or reject join requests.'
const OLD_ADD_MEMBERS_DESCRIPTION = 'The ability to invite and add new people to the group, and to accept or reject join requests.'
const ALL_MEMBERS_ROLE_NAME = 'All Members'
const ALL_MEMBERS_ROLE_DESCRIPTION = 'Everyone in the group holds this role.'

exports.up = async function (knex) {
  const now = new Date()

  await knex('responsibilities')
    .where({ title: ADD_MEMBERS, type: 'system' })
    .update({ description: ADD_MEMBERS_DESCRIPTION, updated_at: now })

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS groups_roles_one_all_members_role
    ON groups_roles (group_id) WHERE type = 'all_members'
  `)

  // The ON CONFLICT predicate must be a literal to match the partial index
  await knex.raw(`
    INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
    SELECT id, ?, '', ?, 'all_members', true, ?, ?
    FROM groups
    WHERE parent_id IS NULL AND type IS DISTINCT FROM 'space'
    ON CONFLICT (group_id) WHERE type = 'all_members' DO NOTHING
  `, [ALL_MEMBERS_ROLE_NAME, ALL_MEMBERS_ROLE_DESCRIPTION, now, now])

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS group_roles_responsibilities_group_role_id_index
    ON group_roles_responsibilities (group_role_id)
  `)

  await knex.raw(`
    CREATE OR REPLACE VIEW group_member_effective_roles AS
    SELECT user_id, group_id, group_role_id
    FROM group_memberships_group_roles
    WHERE active IS NOT FALSE
    UNION
    SELECT gm.user_id, gm.group_id, gr.id AS group_role_id
    FROM group_memberships gm
    JOIN groups_roles gr
      ON gr.group_id = gm.group_id
      AND gr.type = 'all_members'
      AND gr.active = true
    WHERE gm.active = true
  `)
}

exports.down = async function (knex) {
  const now = new Date()
  const allMembersRoleIds = () => knex('groups_roles').where({ type: 'all_members' }).select('id')

  await knex.raw('DROP VIEW IF EXISTS group_member_effective_roles')
  await knex('group_roles_responsibilities').whereIn('group_role_id', allMembersRoleIds()).del()
  await knex('group_memberships_group_roles').whereIn('group_role_id', allMembersRoleIds()).del()
  await knex('group_invites').whereIn('group_role_id', allMembersRoleIds()).update({ group_role_id: null })
  await knex('content_access').whereIn('group_role_id', allMembersRoleIds()).update({ group_role_id: null })
  await knex('tracks').whereIn('completion_role_id', allMembersRoleIds()).update({ completion_role_id: null })
  await knex('groups_roles').where({ type: 'all_members' }).del()

  await knex.raw('DROP INDEX IF EXISTS groups_roles_one_all_members_role')
  await knex.raw('DROP INDEX IF EXISTS group_roles_responsibilities_group_role_id_index')

  await knex('responsibilities')
    .where({ title: ADD_MEMBERS, type: 'system' })
    .update({ description: OLD_ADD_MEMBERS_DESCRIPTION, updated_at: now })
}
