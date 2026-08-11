// Fold Manage Spaces into Administration, then remove the responsibility.

const MANAGE_SPACES = 'Manage Spaces'
const ADMINISTRATION = 'Administration'

exports.up = async function (knex) {
  const manageSpaces = await knex('responsibilities').where({ title: MANAGE_SPACES, type: 'system' }).first()
  if (!manageSpaces) return

  const administration = await knex('responsibilities').where({ title: ADMINISTRATION, type: 'system' }).first()
  if (!administration) {
    throw new Error('Administration responsibility missing; cannot fold Manage Spaces into it')
  }

  const manageSpacesId = Number(manageSpaces.id)
  const administrationId = Number(administration.id)

  // Roles that had Manage Spaces but not Administration get Administration
  await knex.raw(`
    INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
    SELECT DISTINCT grr.group_role_id, ?::bigint
    FROM group_roles_responsibilities grr
    WHERE grr.responsibility_id = ?::bigint
    AND NOT EXISTS (
      SELECT 1 FROM group_roles_responsibilities existing
      WHERE existing.group_role_id = grr.group_role_id
        AND existing.responsibility_id = ?::bigint
    )
  `, [administrationId, manageSpacesId, administrationId])

  await knex('responsibilities')
    .where({ id: administrationId })
    .update({
      description: 'Allows for editing group settings, managing the menu and spaces, exporting data, and deleting the group.',
      updated_at: new Date()
    })

  await knex('group_roles_responsibilities').where({ responsibility_id: manageSpacesId }).delete()
  await knex('responsibilities').where({ id: manageSpacesId }).delete()
}

exports.down = async function (knex) {
  const existing = await knex('responsibilities').where({ title: MANAGE_SPACES, type: 'system' }).first()
  if (existing) return

  const now = new Date()
  const [manageSpaces] = await knex('responsibilities').insert({
    title: MANAGE_SPACES,
    description: 'The ability to create and manage spaces (including tracks and funding rounds) within this group.',
    type: 'system',
    created_at: now,
    updated_at: now
  }).returning('*')

  const manageSpacesId = Number(manageSpaces.id)
  const administration = await knex('responsibilities').where({ title: ADMINISTRATION, type: 'system' }).first()
  if (!administration) return

  // Restore Manage Spaces on Coordinator roles (and any role that has Administration)
  await knex.raw(`
    INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
    SELECT DISTINCT grr.group_role_id, ?::bigint
    FROM group_roles_responsibilities grr
    WHERE grr.responsibility_id = ?::bigint
    AND NOT EXISTS (
      SELECT 1 FROM group_roles_responsibilities existing
      WHERE existing.group_role_id = grr.group_role_id
        AND existing.responsibility_id = ?::bigint
    )
  `, [manageSpacesId, Number(administration.id), manageSpacesId])
}
