// Migration: Add indexes for chatroom performance optimization
// These indexes significantly improve query performance for chat message loading

exports.up = async function (knex) {
  // Index for efficient chat post queries with cursor-based pagination
  // Covers: WHERE type IN (...chat types...) AND active = true ORDER BY id DESC
  await knex.raw(`
    CREATE INDEX posts_chat_type_active_id_idx
    ON posts(type, active, id DESC)
    WHERE type IN ('chat', 'discussion', 'request', 'offer', 'project', 'proposal', 'event', 'resource')
  `)

  // Index for posts ordered by creation time (alternative pagination)
  // Covers: WHERE active = true ORDER BY created_at DESC, id DESC
  await knex.raw(`
    CREATE INDEX posts_created_at_id_idx
    ON posts(created_at DESC, id DESC)
    WHERE active = true
  `)

  // Index for tag-based filtering (critical for chatroom topic queries)
  // Covers: JOIN posts_tags WHERE tag_id IN (...) for reverse lookups
  await knex.schema.alterTable('posts_tags', table => {
    table.index(['tag_id', 'post_id'], 'posts_tags_tag_id_post_id_idx')
  })

  // Index for groups_posts reverse lookups
  // Covers: JOIN groups_posts WHERE group_id = ? for post listing
  await knex.schema.alterTable('groups_posts', table => {
    table.index(['group_id', 'post_id'], 'groups_posts_group_id_post_id_idx')
  })

  // Index for tag_follows queries when checking unread counts
  // Covers: WHERE tag_id = ? AND group_id = ? AND new_post_count > 0
  await knex.raw(`
    CREATE INDEX tag_follows_tag_group_new_posts_idx
    ON tag_follows(tag_id, group_id, new_post_count)
    WHERE new_post_count > 0
  `)

  // Index for tag_follows by user (for fetching all user's chatroom subscriptions)
  await knex.schema.alterTable('tag_follows', table => {
    table.index(['user_id', 'group_id'], 'tag_follows_user_id_group_id_idx')
  })
}

exports.down = async function (knex) {
  // Drop indexes in reverse order
  await knex.schema.alterTable('tag_follows', table => {
    table.dropIndex(['user_id', 'group_id'], 'tag_follows_user_id_group_id_idx')
  })

  await knex.raw('DROP INDEX IF EXISTS tag_follows_tag_group_new_posts_idx')

  await knex.schema.alterTable('groups_posts', table => {
    table.dropIndex(['group_id', 'post_id'], 'groups_posts_group_id_post_id_idx')
  })

  await knex.schema.alterTable('posts_tags', table => {
    table.dropIndex(['tag_id', 'post_id'], 'posts_tags_tag_id_post_id_idx')
  })

  await knex.raw('DROP INDEX IF EXISTS posts_created_at_id_idx')
  await knex.raw('DROP INDEX IF EXISTS posts_chat_type_active_id_idx')
}
