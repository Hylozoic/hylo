exports.up = async function (knex) {
  // Add roles widget to existing self-stewarded groups that don't already have one
  await knex.raw(`
    INSERT INTO context_widgets (
      group_id, title, type, view, "order", created_at, updated_at
    )
    SELECT 
      g.id,
      'widget-roles',
      'roles',
      'roles',
      7,
      NOW(),
      NOW()
    FROM groups g
    WHERE g.mode = 'self_stewarded'
    AND g.active = true
    AND NOT EXISTS (
      SELECT 1 FROM context_widgets cw 
      WHERE cw.group_id = g.id 
      AND cw.title = 'widget-roles'
    )
  `)
}

exports.down = async function (knex) {
  // Remove roles widgets from all groups
  await knex('context_widgets')
    .where('title', 'widget-roles')
    .del()
} 