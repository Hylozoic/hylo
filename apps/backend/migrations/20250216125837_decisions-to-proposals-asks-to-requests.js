exports.up = async function (knex) {
  console.log('Decisions to proposals...')

  // Rename the decisions view to proposals
  await knex('context_widgets')
    .where('title', 'widget-decisions')
    .update({ title: 'widget-proposals', type: 'proposals', view: 'proposals' })

  // Rename the ask-and-offer view to requests-and-offers
  await knex('context_widgets')
    .where('title', 'widget-ask-and-offer')
    .update({ title: 'widget-requests-and-offers', view: 'requests-and-offers' })

  // Fetch all group IDs
  const groups = await knex('groups').select('id');
  const groupIds = groups.map(group => parseInt(group.id));

  // Give each group a widget for the new moderation view
  // Process each group in its own transaction
  for (const groupId of groupIds) {
    console.log('Processing group', groupId,)
    const trx = await knex.transaction();

    try {
      await trx.raw(`
        INSERT INTO context_widgets (
          group_id, title, type, view, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, NOW(), NOW())
      `, [groupId, 'widget-moderation', 'moderation', 'moderation'])

      await trx.commit()
    } catch (error) {
      await trx.rollback()
    }
  }
}

exports.down = async function (knex) {
  await knex('context_widgets')
    .where('title', 'widget-proposals')
    .update({ title: 'widget-decisions', type: 'decisions', view: 'decisions' })

  await knex('context_widgets')
    .where('title', 'widget-requests-and-offers')
    .update({ title: 'widget-ask-and-offer', view: 'ask-and-offer' })

  // delete the moderation widget from each group
  await knex('context_widgets')
    .where('title', 'widget-moderation')
    .delete()
}
