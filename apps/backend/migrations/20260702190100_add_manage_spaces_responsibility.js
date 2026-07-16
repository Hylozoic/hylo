// Spaces & Views spec, section 2.4 — add 'Manage Spaces' and collapse
// legacy 'Manage Tracks' / 'Manage Rounds' into it.

const MANAGE_SPACES = 'Manage Spaces'
const DESCRIPTION = 'The ability to create and manage spaces (including tracks and funding rounds) within this group.'
const LEGACY_TITLES = ['Manage Tracks', 'Manage Rounds']

exports.up = async function (knex) {
  let manageSpaces = await knex('responsibilities').where({ title: MANAGE_SPACES, type: 'system' }).first()
  if (!manageSpaces) {
    const now = new Date()
    ;[manageSpaces] = await knex('responsibilities').insert({
      title: MANAGE_SPACES,
      description: DESCRIPTION,
      type: 'system',
      created_at: now,
      updated_at: now
    }).returning('*')
  }

  const manageSpacesId = Number(manageSpaces.id)

  // Coordinators get Manage Spaces by default
  await knex.raw(`
    INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
    SELECT gr.id, ?::bigint
    FROM groups_roles gr
    WHERE gr.type = 'system' AND gr.name = 'Coordinator'
    AND NOT EXISTS (
      SELECT 1 FROM group_roles_responsibilities grr
      WHERE grr.group_role_id = gr.id AND grr.responsibility_id = ?::bigint
    )
  `, [manageSpacesId, manageSpacesId])

  const legacy = await knex('responsibilities').whereIn('title', LEGACY_TITLES).where({ type: 'system' })
  if (legacy.length === 0) return

  const legacyIds = legacy.map(r => Number(r.id))

  // Roles that had Manage Tracks or Manage Rounds also get Manage Spaces
  await knex.raw(`
    INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
    SELECT DISTINCT grr.group_role_id, ?::bigint
    FROM group_roles_responsibilities grr
    WHERE grr.responsibility_id IN (${legacyIds.map(() => '?::bigint').join(', ')})
    AND NOT EXISTS (
      SELECT 1 FROM group_roles_responsibilities existing
      WHERE existing.group_role_id = grr.group_role_id
        AND existing.responsibility_id = ?::bigint
    )
  `, [manageSpacesId, ...legacyIds, manageSpacesId])

  await knex('group_roles_responsibilities').whereIn('responsibility_id', legacyIds).delete()
  await knex('responsibilities').whereIn('id', legacyIds).delete()
}

exports.down = async function (knex) {
  console.log('[down schema] reverting Manage Spaces responsibility…')
  const now = new Date()
  const restored = []

  for (const title of LEGACY_TITLES) {
    const existing = await knex('responsibilities').where({ title, type: 'system' }).first()
    if (existing) {
      restored.push(existing)
      continue
    }
    const description = title === 'Manage Tracks'
      ? 'Create and manage tracks in the group.'
      : 'Create and manage funding rounds in the group.'
    const [row] = await knex('responsibilities').insert({
      title,
      description,
      type: 'system',
      created_at: now,
      updated_at: now
    }).returning('*')
    restored.push(row)
  }

  const manageSpaces = await knex('responsibilities').where({ title: MANAGE_SPACES, type: 'system' }).first()
  if (manageSpaces) {
    const manageSpacesId = Number(manageSpaces.id)
    // Re-attach legacy responsibilities to roles that currently have Manage Spaces
    for (const resp of restored) {
      const respId = Number(resp.id)
      await knex.raw(`
        INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
        SELECT grr.group_role_id, ?::bigint
        FROM group_roles_responsibilities grr
        WHERE grr.responsibility_id = ?::bigint
        AND NOT EXISTS (
          SELECT 1 FROM group_roles_responsibilities existing
          WHERE existing.group_role_id = grr.group_role_id
            AND existing.responsibility_id = ?::bigint
        )
      `, [respId, manageSpacesId, respId])
    }

    await knex('group_roles_responsibilities').where({ responsibility_id: manageSpacesId }).delete()
    await knex('responsibilities').where({ id: manageSpacesId }).delete()
  }

  console.log('[down schema] Manage Spaces responsibility reverted.')
}
