/**
 * Denormalize post tag names onto posts.tag_names so Post.topics can be
 * resolved without an N+1 through posts_tags.
 */

exports.up = async function (knex) {
  await knex.raw(`
    ALTER TABLE posts
    ADD COLUMN tag_names text[] NOT NULL DEFAULT '{}'::text[]
  `)

  await knex.raw(`
    UPDATE posts SET tag_names = COALESCE((
      SELECT array_agg(tags.name ORDER BY tags.name)
      FROM posts_tags
      JOIN tags ON tags.id = posts_tags.tag_id
      WHERE posts_tags.post_id = posts.id
    ), '{}'::text[])
  `)
}

exports.down = async function (knex) {
  await knex.schema.table('posts', table => {
    table.dropColumn('tag_names')
  })
}
