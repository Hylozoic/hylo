/**
 * activities.group_key names what a notice is about, as `<reason>:<post|comment>:<id>`
 * (api/models/notification/grouping.js). Social feedback notices (reactions, RSVPs,
 * proposal votes) with the same key and reader collapse into one unread notice with a
 * running count, and jobs use the key to tell that a one-off notice (an event reminder,
 * a proposal closing soon) was already sent.
 *
 * Two indexes, both built CONCURRENTLY so the tables stay writable, which must run
 * outside a transaction:
 *   activities_group_key_reader_id_index  keyed notices only (partial), looked up by
 *                                         key, or by key and reader
 *   notifications_activity_id_index       replacing or removing an activity deletes its
 *                                         notifications by activity_id
 * A build that was interrupted leaves an invalid index behind, so that is dropped first.
 */

const INDEXES = [
  {
    name: 'activities_group_key_reader_id_index',
    definition: 'ON activities (group_key, reader_id) WHERE group_key IS NOT NULL'
  },
  {
    name: 'notifications_activity_id_index',
    definition: 'ON notifications (activity_id)'
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
  await knex.raw('ALTER TABLE activities ADD COLUMN IF NOT EXISTS group_key character varying(255)')
  for (const { name, definition } of INDEXES) {
    await dropIfInvalid(knex, name)
    await knex.raw(`CREATE INDEX CONCURRENTLY IF NOT EXISTS ${name} ${definition}`)
  }
}

exports.down = async function (knex) {
  for (const { name } of INDEXES) {
    await knex.raw(`DROP INDEX CONCURRENTLY IF EXISTS ${name}`)
  }
  await knex.raw('ALTER TABLE activities DROP COLUMN IF EXISTS group_key')
}

exports.config = { transaction: false }
