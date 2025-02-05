
exports.up = async function(knex) {

  await knex.raw(`
    DO $$
    DECLARE
        group_record RECORD;
    BEGIN
        FOR group_record IN SELECT id FROM groups WHERE active = false
        LOOP
            WITH home_widget AS (
                INSERT INTO context_widgets (
                    group_id, type, title, "order", created_at, updated_at
                )
                SELECT 
                    group_record.id, 'home', 'widget-home', 1, NOW(), NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM context_widgets 
                    WHERE group_id = group_record.id AND type = 'home'
                )
                RETURNING id
            ),
            home_chat_widget AS (
                INSERT INTO context_widgets (
                    group_id, type, view_chat_id, parent_id, "order", created_at, updated_at
                )
                SELECT
                    group_record.id,
                    'chat',
                    (SELECT id FROM tags WHERE name = 'home'),
                    (SELECT id FROM home_widget),
                    1,
                    NOW(),
                    NOW()
                WHERE NOT EXISTS (
                    SELECT 1 FROM context_widgets
                    WHERE group_id = group_record.id
                    AND type = 'chat'
                    AND parent_id = (SELECT id FROM context_widgets WHERE group_id = group_record.id AND type = 'home')
                )
            ),
            ordered_widgets AS (
                INSERT INTO context_widgets (
                    group_id, title, type, view, "order", visibility, created_at, updated_at
                )
                SELECT v.* FROM (VALUES
                    (group_record.id, 'widget-chats', 'chats', NULL, 2, NULL, NOW(), NOW()),
                    (group_record.id, 'widget-auto-view', 'auto-view', NULL, 3, NULL, NOW(), NOW()),
                    (group_record.id, 'widget-members', 'members', 'members', 4, NULL, NOW(), NOW()),
                    (group_record.id, 'widget-setup', 'setup', NULL, 5, 'admin', NOW(), NOW()),
                    (group_record.id, 'widget-custom-views', 'custom-views', NULL, 6, NULL, NOW(), NOW())
                ) AS v(group_id, title, type, view, "order", visibility, created_at, updated_at)
                WHERE NOT EXISTS (
                    SELECT 1 FROM context_widgets w
                    WHERE w.group_id = v.group_id AND w.title = v.title
                )
            )
            INSERT INTO context_widgets (
                group_id, title, type, view, created_at, updated_at
            )
            SELECT v.* FROM (VALUES
                (group_record.id, 'widget-discussions', NULL, 'discussions', NOW(), NOW()),
                (group_record.id, 'widget-ask-and-offer', NULL, 'ask-and-offer', NOW(), NOW()),
                (group_record.id, 'widget-stream', NULL, 'stream', NOW(), NOW()),
                (group_record.id, 'widget-events', 'events', 'events', NOW(), NOW()),
                (group_record.id, 'widget-projects', 'projects', 'projects', NOW(), NOW()),
                (group_record.id, 'widget-groups', 'groups', 'groups', NOW(), NOW()),
                (group_record.id, 'widget-decisions', 'decisions', 'decisions', NOW(), NOW()),
                (group_record.id, 'widget-about', 'about', 'about', NOW(), NOW()),
                (group_record.id, 'widget-map', 'map', 'map', NOW(), NOW()),
                (group_record.id, 'widget-resources', 'resources', 'resources', NOW(), NOW())
            ) AS v(group_id, title, type, view, created_at, updated_at)
            WHERE NOT EXISTS (
                SELECT 1 FROM context_widgets w
                WHERE w.group_id = v.group_id AND w.title = v.title
            );
        END LOOP;
    END $$;
  `);

  const groups = await knex('groups').select('id').where('active', false);
  const groupIds = groups.map(group => parseInt(group.id));

  // Process each group in its own transaction
  for (const groupId of groupIds) {
    console.log('Processing group', groupId,)
    const trx = await knex.transaction();

    try {
      await trx.raw(`
        WITH widgets AS (
          SELECT * FROM context_widgets WHERE group_id = ?
        ),
        auto_add_widget AS (
          SELECT id FROM context_widgets WHERE type = 'auto-view' and group_id = ? LIMIT 1
        ),
        update_stream AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 1
          WHERE (view = 'stream' AND group_id = ?)
        ),
        has_discussions AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type IN ('discussion') LIMIT 1
        ),
        update_discussions AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 2
          WHERE (view = 'discussions' AND group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_discussions)
        ),
        has_events AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type = 'event' LIMIT 1
        ),
        update_events AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 3
          WHERE (type = 'events' AND group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_events)
        ),
        has_projects AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type = 'project' LIMIT 1
        ),
        update_projects AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 4
          WHERE (type = 'projects' and group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_projects)
        ),
        has_asks_offers AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type IN ('request', 'offer') LIMIT 1
        ),
        update_ask_offer AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 5
          WHERE (view = 'ask-and-offer' AND group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_asks_offers)
        ),
        has_resources AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type = 'resource' LIMIT 1
        ),
        update_resources AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 6
          WHERE (view = 'resources' AND group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_resources)
        ),
        has_proposals AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.type = 'proposal' LIMIT 1
        ),
        has_moderation AS (
          SELECT 1 FROM moderation_actions WHERE group_id = ? LIMIT 1
        ),
        update_decisions AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 7
          WHERE (type = 'decisions' and group_id = ? AND auto_added = FALSE) AND (EXISTS (SELECT 1 FROM has_proposals) OR EXISTS (SELECT 1 FROM has_moderation))
        ),
        has_location_posts AS (
          SELECT 1 FROM posts
          JOIN groups_posts ON groups_posts.post_id = posts.id
          WHERE groups_posts.group_id = ? AND posts.location_id IS NOT NULL LIMIT 1
        ),
        has_members_with_location AS (
          SELECT 1 FROM users
          JOIN group_memberships ON users.id = group_memberships.user_id
          WHERE group_memberships.group_id = ? AND users.location_id IS NOT NULL LIMIT 1
        ),
        update_map AS (
          UPDATE context_widgets
          SET parent_id = (SELECT id FROM auto_add_widget), "order" = 8
          WHERE (type = 'map' and group_id = ? AND auto_added = FALSE) AND (EXISTS (SELECT 1 FROM has_location_posts) OR EXISTS (SELECT 1 FROM has_members_with_location))
        ),
        has_related_groups AS (
          SELECT 1 FROM group_relationships
          WHERE parent_group_id = ? OR child_group_id = ? LIMIT 1
        )
        UPDATE context_widgets
        SET parent_id = (SELECT id FROM auto_add_widget), "order" = 9
        WHERE (type = 'groups' and group_id = ? AND auto_added = FALSE) AND EXISTS (SELECT 1 FROM has_related_groups);
      `, [groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId, groupId]);

      await trx.raw(`
        WITH auto_add_widget AS (
          SELECT id FROM context_widgets WHERE type = 'auto-view' and group_id = ? LIMIT 1
        ),
        numbered_widgets AS (
          SELECT
            id,
            ROW_NUMBER() OVER (ORDER BY "order" ASC) as new_order
          FROM context_widgets
          WHERE parent_id = (SELECT id FROM auto_add_widget)
        )
        UPDATE context_widgets
        SET "order" = numbered_widgets.new_order
        FROM numbered_widgets
        WHERE context_widgets.id = numbered_widgets.id
      `, [groupId])

      await trx.commit();
    } catch (error) {
      await trx.rollback();
      throw error;
    }
  }
  
};

exports.down = function(knex) {
  
};
