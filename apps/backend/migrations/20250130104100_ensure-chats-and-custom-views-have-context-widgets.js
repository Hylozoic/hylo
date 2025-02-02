exports.up = function(knex) {
  console.log('Ensuring chats and custom views have context widgets')
  // This call is idempotent; you can run it many times and it will just sync chats/custcomes up to their needed widgets.
  return knex.raw(`
    WITH RECURSIVE all_groups AS (
      SELECT id FROM groups WHERE active = true
    ),
    all_groups_with_widgets AS (
      SELECT
        g.id as group_id,
        EXISTS (
          SELECT 1
          FROM context_widgets cw
          WHERE cw.group_id = g.id
        ) as has_widgets
      FROM all_groups g
    ),
    group_existing_widgets AS (
      SELECT
        g.id as group_id,
        cw.id as widget_id,
        cw.type,
        CASE
          WHEN cw.type = 'chats' THEN 'chats'
          WHEN cw.type = 'custom-views' THEN 'custom_views'
        END as parent_type
      FROM all_groups g
      LEFT JOIN context_widgets cw ON cw.group_id = g.id
      WHERE cw.type IN ('chats', 'custom-views')
    ),
    new_chat_widgets AS (
      SELECT DISTINCT
        gp.group_id,
        t.id as tag_id,
        t.name,
        gt.visibility,
        EXISTS (
          SELECT 1
          FROM context_widgets
          WHERE group_id = gp.group_id
            AND type = 'chat'
            AND view_chat_id = t.id
        ) as has_widget
      FROM all_groups g
      JOIN groups_posts gp ON gp.group_id = g.id
      JOIN posts p ON p.id = gp.post_id
      JOIN posts_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      JOIN groups_tags gt ON gt.tag_id = t.id AND gt.group_id = gp.group_id
      WHERE p.type = 'chat'
        AND t.name != 'general'
    ),
    new_custom_view_widgets AS (
      SELECT
        cv.group_id,
        cv.id as custom_view_id,
        cv.order,
        EXISTS (
          SELECT 1
          FROM context_widgets
          WHERE group_id = cv.group_id
            AND custom_view_id = cv.id
        ) as has_widget
      FROM custom_views cv
      JOIN all_groups g ON g.id = cv.group_id
    )

    INSERT INTO context_widgets (
      group_id,
      title,
      type,
      parent_id,
      "order",
      view_chat_id,
      custom_view_id,
      auto_added,
      created_at,
      updated_at
    )
    -- Insert chat widgets
    SELECT
      ncw.group_id,
      ncw.name,
      'chat'::text,
      CASE
        WHEN ncw.visibility = 2 THEN (
          SELECT widget_id
          FROM group_existing_widgets
          WHERE group_id = ncw.group_id
            AND parent_type = 'chats'
          LIMIT 1
        )
        ELSE NULL
      END,
      CASE
        WHEN ncw.visibility = 2 THEN (
          ROW_NUMBER() OVER (PARTITION BY ncw.group_id ORDER BY ncw.name)
        )
        ELSE NULL
      END,
      ncw.tag_id,
      NULL,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM new_chat_widgets ncw
    WHERE NOT ncw.has_widget

    UNION ALL

    -- Insert custom view widgets
    SELECT
      ncvw.group_id,
      NULL,
      NULL,
      (
        SELECT widget_id
        FROM group_existing_widgets
        WHERE group_id = ncvw.group_id
          AND parent_type = 'custom_views'
        LIMIT 1
      ),
      ROW_NUMBER() OVER (PARTITION BY ncvw.group_id ORDER BY ncvw.order),
      NULL,
      ncvw.custom_view_id,
      true,
      CURRENT_TIMESTAMP,
      CURRENT_TIMESTAMP
    FROM new_custom_view_widgets ncvw
    WHERE NOT ncvw.has_widget
  `);
};

exports.down = function(knex) {
  // Since this migration only adds widgets where they're missing,
  // and doesn't modify existing ones, we don't need a down migration
  return Promise.resolve();
};
