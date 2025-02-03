/* globals Group  */
require("@babel/register")
const models = require('../api/models')

exports.up = async function(knex) {
  // Fetch all group IDs
  const groups = await knex('groups').select('id');
  const groupIds = groups.map(group => parseInt(group.id));

  // Process each group in its own transaction
  for (const groupId of groupIds) {
    console.log('Processing group', groupId,)
    const trx = await knex.transaction();

    try {
      await trx.raw(`
        INSERT INTO context_widgets (
          group_id, title, type, view, created_at, updated_at
        )
        SELECT v.* FROM (VALUES
          (CAST(? AS bigint), 'widget-resources', 'resources', 'resources', NOW(), NOW())
        ) AS v(group_id, title, type, view, created_at, updated_at)
        WHERE NOT EXISTS (
          SELECT 1 FROM context_widgets w
          WHERE w.group_id = ? AND w.title = 'widget-resources'
        )
        RETURNING id
      `, [groupId, groupId])

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
