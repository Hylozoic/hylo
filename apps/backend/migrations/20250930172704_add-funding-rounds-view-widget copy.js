exports.up = async function (knex) {
  // Fetch all group IDs
  const groups = await knex('groups').select('id')
  const groupIds = groups.map(group => parseInt(group.id))

  // Process each group in its own transaction
  for (const groupId of groupIds) {
    console.log('Add Funding Rounds View widget - processing group', groupId)
    const trx = await knex.transaction()
    try {
      await trx.raw(`
       INSERT INTO context_widgets (
         group_id, title, type, view, created_at, updated_at, visibility
       )
       SELECT v.* FROM (VALUES
         (CAST(? AS bigint), 'widget-funding-rounds', 'funding-rounds', 'funding-rounds', NOW(), NOW(), 'admin')
       ) AS v(group_id, title, type, view, created_at, updated_at, visibility)
       WHERE NOT EXISTS (
         SELECT 1 FROM context_widgets w
         WHERE w.group_id = ? AND w.title = 'widget-funding-rounds'
       )
       RETURNING id
     `, [groupId, groupId])

      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
}

exports.down = async function (knex) {
  await knex('context_widgets')
    .where('title', 'widget-funding-rounds')
    .delete()
}
