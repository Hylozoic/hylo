/**
 * Spaces & Views Step 9: remove #general from all posts and delete the tag.
 * Deferred from 20260703000000 because this is destructive and not reversible.
 *
 * Also clears join rows and nullable FKs that would otherwise block deleting
 * the tags row (groups_tags, tag_follows, comments_tags, etc.).
 */

/** Strip #general from posts, related join tables, and the tags table. */
exports.up = async function up (knex) {
  const generalTag = await knex('tags').where({ name: 'general' }).first()
  if (!generalTag) return

  const tagId = generalTag.id

  await knex.raw(`
    UPDATE posts
    SET tag_names = array_remove(tag_names, 'general')
    WHERE 'general' = ANY(tag_names)
  `)

  await knex('posts_tags').where({ tag_id: tagId }).del()
  await knex('comments_tags').where({ tag_id: tagId }).del()
  await knex('groups_tags').where({ tag_id: tagId }).del()
  await knex('tag_follows').where({ tag_id: tagId }).del()

  if (await knex.schema.hasTable('saved_search_topics')) {
    await knex('saved_search_topics').where({ tag_id: tagId }).del()
  }
  if (await knex.schema.hasTable('custom_view_topics')) {
    await knex('custom_view_topics').where({ tag_id: tagId }).del()
  }
  if (await knex.schema.hasColumn('drafts', 'topic_id')) {
    await knex('drafts').where({ topic_id: tagId }).update({ topic_id: null })
  }
  if (await knex.schema.hasColumn('group_invites', 'tag_id')) {
    await knex('group_invites').where({ tag_id: tagId }).update({ tag_id: null })
  }
  // Null leftover chat widgets so ON DELETE CASCADE does not drop them.
  if (await knex.schema.hasTable('context_widgets')) {
    await knex('context_widgets').where({ view_chat_id: tagId }).update({ view_chat_id: null })
  }

  await knex('tags').where({ id: tagId }).del()
}

exports.down = async function down (knex) {
  // Irreversible — #general post/tag associations are not restored.
}
