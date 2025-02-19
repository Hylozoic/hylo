
exports.up = async function(knex) {
  const allGroups = await knex('groups').select('id')
  const allGroupIds = allGroups.map(group => parseInt(group.id));

  // Process each group in its own transaction
  for (const groupId of allGroupIds) {
    console.log('Ensuring home-chat is default view', groupId)
    const trx = await knex.transaction()

    try {

      await trx.raw(`
        WITH home_widget AS (
          SELECT id FROM context_widgets WHERE type = 'home' and group_id = ? LIMIT 1
        ),
        existing_home_chat_widget AS (
          SELECT id FROM context_widgets 
          WHERE type = 'chat' 
          AND group_id = ? 
          AND view_chat_id = (SELECT id FROM tags WHERE name = 'home')
          LIMIT 1
        ),
        create_home_chat_widget AS (
          INSERT INTO context_widgets (
            group_id, type, view_chat_id, parent_id, "order", created_at, updated_at
          )
          SELECT
            ?,
            'chat',
            (SELECT id FROM tags WHERE name = 'home'),
            (SELECT id FROM home_widget),
            1,
            NOW(),
            NOW()
          WHERE NOT EXISTS (SELECT 1 FROM existing_home_chat_widget)
          RETURNING id
        ),
        reset_other_children AS (
          UPDATE context_widgets
          SET parent_id = NULL,
              "order" = NULL
          WHERE parent_id = (SELECT id FROM home_widget)
          AND id != COALESCE(
            (SELECT id FROM existing_home_chat_widget),
            (SELECT id FROM create_home_chat_widget)
          )
        )
        UPDATE context_widgets
        SET parent_id = (SELECT id FROM home_widget),
            "order" = 1
        WHERE id = COALESCE(
          (SELECT id FROM existing_home_chat_widget),
          (SELECT id FROM create_home_chat_widget)
        );
      `, [groupId, groupId, groupId])
      
      await trx.commit()
    } catch (error) {
      await trx.rollback()
      throw error
    }
  }
};

exports.down = function(knex) {
  return Promise.resolve()
};
