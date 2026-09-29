/**
 * Recent chat messages by time. Every chat message looks up who else chatted in its
 * room within the conversation window (notification/rules/adaptiveImportant.js,
 * conversationParticipants); this index keeps that lookup to the last few minutes of
 * chats instead of the room's whole history.
 *
 * Built CONCURRENTLY so posts stay writable while it builds, which must run outside a
 * transaction. A build that was interrupted leaves an invalid index behind, so that
 * is dropped first.
 */

const INDEX = 'posts_chat_created_at_index'

exports.up = async function (knex) {
  const invalid = await knex.raw(`
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = ? AND NOT i.indisvalid
  `, [INDEX])
  if (invalid.rows.length > 0) await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX}`)
  await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${INDEX} ON posts (created_at) WHERE type = 'chat'`)
}

exports.down = async function (knex) {
  await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${INDEX}`)
}

exports.config = { transaction: false }
