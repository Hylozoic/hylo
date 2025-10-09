exports.up = async function (knex) {
  await knex.schema.alterTable('context_widgets', function (table) {
    table.bigInteger('view_funding_round_id').references('id').inTable('funding_rounds')
  })

  // Add Funding Rounds View widget to all groups
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
  await knex.schema.alterTable('context_widgets', function (table) {
    table.dropColumn('view_funding_round_id')
  })

  await knex('context_widgets')
    .where('title', 'widget-funding-rounds')
    .delete()
}
