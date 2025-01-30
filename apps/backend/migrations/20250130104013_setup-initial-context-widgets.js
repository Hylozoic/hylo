exports.up = function(knex) {
  return knex.raw(`
    DO $$
    DECLARE
        group_record RECORD;
    BEGIN
        FOR group_record IN SELECT id FROM groups WHERE active = true
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
                    (SELECT id FROM context_widgets WHERE group_id = group_record.id AND type = 'home'), 
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
                (group_record.id, 'widget-map', 'map', 'map', NOW(), NOW())
            ) AS v(group_id, title, type, view, created_at, updated_at)
            WHERE NOT EXISTS (
                SELECT 1 FROM context_widgets w
                WHERE w.group_id = v.group_id AND w.title = v.title
            );
        END LOOP;
    END $$;
  `);
};

exports.down = function(knex) {
  return Promise.resolve();
};
