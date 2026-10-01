/**
 * Lookups for digests that leave out what a member already has (D39,
 * lib/group/digest2/dedupe.js) and for the open-request nudge (D58,
 * api/models/post/openRequestNudge.js):
 *
 * - activities by post and reader: "was this post emailed to this person?" and
 *   "has this post been nudged?" read a handful of posts at a time.
 * - emailed notifications by activity: the email row for those activities.
 *
 * Built CONCURRENTLY so both tables stay writable while they build, which must run
 * outside a transaction. A build that was interrupted leaves an invalid index behind,
 * so that is dropped first.
 */

const INDEXES = [
  {
    name: 'activities_post_id_reader_id_index',
    definition: 'ON activities (post_id, reader_id) WHERE post_id IS NOT NULL'
  },
  {
    name: 'notifications_activity_id_email_index',
    definition: 'ON notifications (activity_id) WHERE medium = 2'
  }
]

async function dropIfInvalid (knex, name) {
  const invalid = await knex.raw(`
    SELECT 1 FROM pg_index i
    JOIN pg_class c ON c.oid = i.indexrelid
    WHERE c.relname = ? AND NOT i.indisvalid
  `, [name])
  if (invalid.rows.length > 0) await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`)
}

exports.up = async function (knex) {
  for (const { name, definition } of INDEXES) {
    await dropIfInvalid(knex, name)
    await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ${definition}`)
  }
}

exports.down = async function (knex) {
  for (const { name } of INDEXES) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`)
  }
}

exports.config = { transaction: false }
