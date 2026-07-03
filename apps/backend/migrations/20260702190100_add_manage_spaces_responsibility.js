// Spaces & Views spec, section 2.4 — new system responsibility 'Manage Spaces',
// granted to every existing group's Coordinator role by default.

const TITLE = 'Manage Spaces'
const DESCRIPTION = 'The ability to create new spaces (child groups) within this group.'

exports.up = async function (knex) {
  let responsibility = await knex('responsibilities').where({ title: TITLE, type: 'system' }).first()
  if (!responsibility) {
    const now = new Date()
    ;[responsibility] = await knex('responsibilities').insert({
      title: TITLE,
      description: DESCRIPTION,
      type: 'system',
      created_at: now,
      updated_at: now
    }).returning('*')
  }

  await knex.raw(`
    INSERT INTO group_roles_responsibilities (group_role_id, responsibility_id)
    SELECT gr.id, ?
    FROM groups_roles gr
    WHERE gr.type = 'system' AND gr.name = 'Coordinator'
    AND NOT EXISTS (
      SELECT 1 FROM group_roles_responsibilities grr
      WHERE grr.group_role_id = gr.id AND grr.responsibility_id = ?
    )
  `, [responsibility.id, responsibility.id])
}

exports.down = async function (knex) {
  const responsibility = await knex('responsibilities').where({ title: TITLE, type: 'system' }).first()
  if (!responsibility) return

  await knex('group_roles_responsibilities').where({ responsibility_id: responsibility.id }).delete()
  await knex('responsibilities').where({ id: responsibility.id }).delete()
}
