/**
 * D73: weekly digests were sent monthly by mistake until August. There is no catch-up
 * email; instead, each member who chose a weekly digest gets one line about it in
 * their next weekly digest.
 *
 * This flags those members (users.settings.weekly_digest_notice_pending = true): active
 * people with an active membership in an active group (not a space, since spaces have
 * no digest of their own) whose digest is weekly and whose group email is on.
 * lib/group/digest2/weeklyNotice.js adds the line and sets the flag to false once that
 * digest has been sent.
 *
 * Safe to run again: anyone who already has the setting, including those whose line
 * has gone out (false), is left alone.
 */

const KEY = 'weekly_digest_notice_pending'

exports.up = async function (knex) {
  await knex.raw(`
    UPDATE users
    SET settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object(?::text, true)
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
  `, [KEY, KEY])
}

exports.down = async function (knex) {
  await knex.raw(`
    UPDATE users
    SET settings = settings - ?::text
    WHERE settings -> ?::text IS NOT NULL
  `, [KEY, KEY])
}
