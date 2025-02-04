exports.up = async function(knex) {
  // Fetch all group IDs
  const groups = await knex('groups').where('active', true).select('id');
  const groupIds = groups.map(group => parseInt(group.id))

  // Process each group in its own transaction
  for (const groupId of groupIds) {
    console.log('Settling auto-view order for group', groupId,)
    const trx = await knex.transaction()

    const autoViewWidget = await trx('context_widgets')
      .where({
        type: 'auto-view',
        group_id: groupId
      })
      .first();

    try {
      await trx.raw(`
        WITH numbered_widgets AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "order" ASC) as new_order
          FROM context_widgets
          WHERE parent_id = ?
        )
        UPDATE context_widgets
        SET "order" = numbered_widgets.new_order
        FROM numbered_widgets
        WHERE context_widgets.id = numbered_widgets.id
      `, [autoViewWidget.id]);

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
};

exports.down = function(knex) {
  // Implement the down migration if necessary
};
