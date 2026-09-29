/* global bookshelf */
/*
  When a group last had one of its scheduled steward notices, one row per group and
  kind in group_notice_marks. The rows live outside groups.settings, which a stale
  Group#save can overwrite.
*/

export const KIND = {
  NEWCOMER_NOTICE: 'newcomer_notice', // group/newcomerBatch.js
  STEWARD_DIGEST: 'steward_digest', // lib/group/stewardDigest.js, the weekly email
  QUIET_PROMPT: 'quiet_prompt' // lib/group/stewardDigest.js, no posts for 30 days
}

/**
 * SQL condition (and bindings) that is true when the group whose id is in groupIdSql
 * had no notice of this kind after `since`.
 */
export function notMarkedSinceCondition (groupIdSql, kind, since) {
  return {
    sql: `NOT EXISTS (
      SELECT 1 FROM group_notice_marks mark
      WHERE mark.group_id = ${groupIdSql} AND mark.kind = ? AND mark.sent_at > ?
    )`,
    bindings: [kind, since]
  }
}

/**
 * Records a notice of this kind for the group at `at`, unless one was recorded after
 * `unlessAfter`. Returns true when this call recorded it, so only one of several
 * overlapping runs goes on to send.
 */
export async function claim (groupId, kind, at, { unlessAfter } = {}) {
  const { rows } = await bookshelf.knex.raw(`
    INSERT INTO group_notice_marks (group_id, kind, sent_at) VALUES (?, ?, ?)
    ON CONFLICT (group_id, kind) DO UPDATE SET sent_at = EXCLUDED.sent_at
      WHERE group_notice_marks.sent_at <= ?
    RETURNING group_id
  `, [groupId, kind, at, unlessAfter || at])
  return rows.length > 0
}

/**
 * When the group last had a notice of this kind, or null.
 */
export async function lastSentAt (groupId, kind) {
  const row = await bookshelf.knex('group_notice_marks').where({ group_id: groupId, kind }).first('sent_at')
  return row ? row.sent_at : null
}
