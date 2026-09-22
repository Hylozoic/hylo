/**
 * Older posts stored topics on posts_tags (from a separate editor field)
 * without putting #tags in the body. Those tags are no longer shown in the
 * post UI, so append any attached tag that does not already appear as #tag
 * in the description.
 *
 * Appended as HyloEditor TopicMentions HTML (span.topic with data-type / data-id
 * / data-label) so ClickCatcher and the editor treat them as clickable topics,
 * not plain text. Wrapped in <p> so TipTap can parse them as a block.
 *
 * Chat, thread, and welcome posts are skipped: their posts_tags rows are
 * room/context metadata still shown in those UIs, not a hidden editor field.
 *
 * Matching is translate/strpos (not regex or bytea casts) so old HTML with
 * backslashes or invalid UTF-8 does not abort the migration. Tag names are
 * run through the same translate: otherwise a tag like foo.bar is stored as
 * #foo.bar, the body becomes "#foo bar", and a search for " #foo.bar " misses.
 */

const SEPARATORS = `'<>"''&/.,!?;:=' || chr(10) || chr(13) || chr(9)`
const BODY_NORM = `translate(lower(COALESCE(p.description, '')), ${SEPARATORS}, repeat(' ', 16))`
const TAG_NORM = `translate(lower(t.name), ${SEPARATORS}, repeat(' ', 16))`

// Matches HyloEditor TopicMentions / TextHelpers.topicHTML stored markup
const TOPIC_SPAN = `'<span data-type="topic" class="topic" data-id="' || tag_name || '" data-label="#' || tag_name || '">#' || tag_name || '</span>'`

/** Append attached-but-unmentioned hashtags to the end of post bodies. */
exports.up = async function up (knex) {
  await knex.raw(`
    WITH tagged AS (
      SELECT
        p.id AS post_id,
        t.name AS tag_name,
        ${BODY_NORM} AS body_norm,
        ${TAG_NORM} AS tag_norm
      FROM posts p
      JOIN posts_tags pt ON pt.post_id = p.id
      JOIN tags t ON t.id = pt.tag_id
      WHERE p.type NOT IN ('chat', 'chat_activity', 'thread', 'welcome')
    ),
    missing AS (
      SELECT
        post_id,
        string_agg(${TOPIC_SPAN}, ' ' ORDER BY tag_name) AS tag_row
      FROM tagged
      WHERE strpos(' ' || body_norm || ' ', ' #' || tag_norm || ' ') = 0
      GROUP BY post_id
    )
    UPDATE posts
    SET description = COALESCE(posts.description, '') || '<p>' || missing.tag_row || '</p>'
    FROM missing
    WHERE posts.id = missing.post_id
  `)
}

/** Irreversible — appended hashtags are not stripped. */
exports.down = async function down (knex) {}
