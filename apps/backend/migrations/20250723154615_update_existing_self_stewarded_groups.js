exports.up = async function (knex) {
  // Update groups that have roles with assignment = 'trust' to have mode = 'self_stewarded'
  await knex.raw(`
    UPDATE groups
    SET mode = 'self_stewarded'
    WHERE id IN (
      SELECT DISTINCT gr.group_id
      FROM groups_roles gr
      WHERE gr.assignment = 'trust'
    )
    AND (mode IS NULL OR mode = '')
  `)
}

exports.down = async function (knex) {
  // Revert by setting mode back to 'admined' for groups that were updated
  await knex.raw(`
    UPDATE groups
    SET mode = 'admined'
    WHERE id IN (
      SELECT DISTINCT gr.group_id
      FROM groups_roles gr
      WHERE gr.assignment = 'trust'
    )
    AND mode = 'self_stewarded'
  `)
} 