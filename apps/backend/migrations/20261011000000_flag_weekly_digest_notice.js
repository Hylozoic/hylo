/**
 * D73: weekly digests were sent monthly by mistake until August. There is no catch-up
 * email; instead, each member who chose a weekly digest gets one line about it in
 * their next weekly digest.
 *
 * This flags those members (users.settings.weekly_digest_notice_pending = true, and
 * weekly_digest_notice_flagged_at = now): active people with an active membership in
 * an active group (not a space, since spaces have no digest of their own) whose digest
 * is weekly and whose group email is on. lib/group/digest2/weeklyNotice.js adds the
 * line, for six weeks from flagged_at, and sets the flag to false once that digest has
 * been sent.
 *
 * Safe to run again: anyone who already has the setting, including those whose line
 * has gone out (false), is left alone.
 */

const KEY = 'weekly_digest_notice_pending'
const FLAGGED_AT = 'weekly_digest_notice_flagged_at'

exports.up = async function (knex) {
  await knex.raw(`
    UPDATE users
    SET settings = COALESCE(settings, '{}'::jsonb) ||
      jsonb_build_object(?::text, true, ?::text, to_jsonb(date_trunc('second', now())))
    WHERE active = true
      AND COALESCE(settings, '{}'::jsonb) -> ?::text IS NULL
      AND id IN (
        SELECT gm.user_id
        FROM group_memberships gm
        JOIN groups g ON g.id = gm.group_id
        WHERE gm.active = true
          AND g.active = true
          AND (g.type IS NULL OR g.type <> 'space')
          AND gm.settings ->> 'digestFrequency' = 'weekly'
          AND (gm.settings ->> 'sendEmail')::boolean = true
      )
  `, [KEY, FLAGGED_AT, KEY])
}

exports.down = async function (knex) {
  await knex.raw(`
    UPDATE users
    SET settings = settings - ?::text - ?::text
    WHERE settings -> ?::text IS NOT NULL OR settings -> ?::text IS NOT NULL
  `, [KEY, FLAGGED_AT, KEY, FLAGGED_AT])
}
