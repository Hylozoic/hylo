/**
 * Add the system responsibility 'Invite Members' and an implicit 'Member' role
 * (type 'member') for every top-level group.
 *
 * Member roles have no group_memberships_group_roles rows: every active member
 * of the group holds the role. This migration links nothing to them, so no
 * group's invite behaviour changes until an Administrator changes its policy.
 *
 * down() does not restore the titles of custom responsibilities renamed to
 * avoid a clash with the new system title.
 */

const INVITE_MEMBERS = 'Invite Members'
const INVITE_MEMBERS_DESCRIPTION = 'Send personal email invitations to this group and see or cancel the ones you sent. In Restricted and Closed groups a steward reviews them.'
const ADD_MEMBERS = 'Add Members'
const ADD_MEMBERS_DESCRIPTION = 'Invite and add new people, manage the group join link and all pending invitations, and accept or reject join requests.'
const OLD_ADD_MEMBERS_DESCRIPTION = 'The ability to invite and add new people to the group, and to accept or reject join requests.'
const MEMBER_ROLE_NAME = 'Member'
const MEMBER_ROLE_DESCRIPTION = 'Everyone in the group holds this role.'

exports.up = async function (knex) {
  const now = new Date()

  const renamed = await knex('responsibilities')
    .whereRaw("type IS DISTINCT FROM 'system'")
    .whereRaw('lower(trim(title)) = ?', [INVITE_MEMBERS.toLowerCase()])
    .update({ title: knex.raw("trim(title) || ' (custom)'"), updated_at: now })
  if (renamed > 0) {
    console.log(`Appended " (custom)" to ${renamed} custom responsibilities titled "${INVITE_MEMBERS}"`)
  }

  await knex.raw(`
    INSERT INTO responsibilities (title, description, type, created_at, updated_at)
    SELECT ?, ?, 'system', ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM responsibilities WHERE title = ? AND type = 'system')
  `, [INVITE_MEMBERS, INVITE_MEMBERS_DESCRIPTION, now, now, INVITE_MEMBERS])

  await knex('responsibilities')
    .where({ title: ADD_MEMBERS, type: 'system' })
    .update({ description: ADD_MEMBERS_DESCRIPTION, updated_at: now })

  await knex.raw(`
    CREATE UNIQUE INDEX IF NOT EXISTS groups_roles_one_member_role
    ON groups_roles (group_id) WHERE type = 'member'
  `)

  // The ON CONFLICT predicate must be a literal to match the partial index
  await knex.raw(`
    INSERT INTO groups_roles (group_id, name, emoji, description, type, active, created_at, updated_at)
    SELECT id, ?, '', ?, 'member', true, ?, ?
    FROM groups
    WHERE parent_id IS NULL AND type IS DISTINCT FROM 'space'
    ON CONFLICT (group_id) WHERE type = 'member' DO NOTHING
  `, [MEMBER_ROLE_NAME, MEMBER_ROLE_DESCRIPTION, now, now])

  await knex.raw(`
    CREATE INDEX IF NOT EXISTS group_roles_responsibilities_group_role_id_index
    ON group_roles_responsibilities (group_role_id)
  `)
}

exports.down = async function (knex) {
  const now = new Date()
  const memberRoleIds = () => knex('groups_roles').where({ type: 'member' }).select('id')
  const inviteMembersIds = () => knex('responsibilities').where({ title: INVITE_MEMBERS, type: 'system' }).select('id')

  await knex('group_roles_responsibilities').whereIn('responsibility_id', inviteMembersIds()).del()
  await knex('group_roles_responsibilities').whereIn('group_role_id', memberRoleIds()).del()
  await knex('group_memberships_group_roles').whereIn('group_role_id', memberRoleIds()).del()
  await knex('group_invites').whereIn('group_role_id', memberRoleIds()).update({ group_role_id: null })
  await knex('content_access').whereIn('group_role_id', memberRoleIds()).update({ group_role_id: null })
  await knex('tracks').whereIn('completion_role_id', memberRoleIds()).update({ completion_role_id: null })
  await knex('groups_roles').where({ type: 'member' }).del()
  await knex('responsibilities').where({ title: INVITE_MEMBERS, type: 'system' }).del()

  await knex.raw('DROP INDEX IF EXISTS groups_roles_one_member_role')
  await knex.raw('DROP INDEX IF EXISTS group_roles_responsibilities_group_role_id_index')

  await knex('responsibilities')
    .where({ title: ADD_MEMBERS, type: 'system' })
    .update({ description: OLD_ADD_MEMBERS_DESCRIPTION, updated_at: now })
}
