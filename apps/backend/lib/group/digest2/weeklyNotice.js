/* global bookshelf, sails */
// D73: one line about the weekly-digest mix-up in a flagged member's next weekly
// digest (migrations/20261011000000_flag_weekly_digest_notice.js sets the flag).
//
// Someone in several weekly groups gets several digests in the same run, so the first
// digest this process builds for them claims the line; the others go without it. The
// flag is set to false only once that digest has been sent. If the send fails, the
// claim is released and a later weekly digest carries the line instead.
import { getLocaleStrings } from '../../i18n/locales'

export const WEEKLY_NOTICE_SETTING = 'weekly_digest_notice_pending'

const claimed = new Set()

const isFlagged = user => (user.get('settings') || {})[WEEKLY_NOTICE_SETTING] === true

/**
 * The translated line for this person's weekly digest, or null. Claims it, so call
 * settleWeeklyDigestNotice after the send.
 */
export function claimWeeklyDigestNotice (user, type) {
  if (type !== 'weekly' || !user || !isFlagged(user)) return null
  const key = String(user.id)
  if (claimed.has(key)) return null
  claimed.add(key)
  return getLocaleStrings(user.getLocale()).emailDigestWeeklyMixupNotice()
}

/** Gives the line back so a later digest can carry it. */
export function releaseWeeklyDigestNotice (user) {
  if (user) claimed.delete(String(user.id))
}

async function clearFlag (user) {
  await bookshelf.knex.raw(`
    UPDATE users
    SET settings = jsonb_set(COALESCE(settings, '{}'::jsonb), ?::text[], 'false'::jsonb)
    WHERE id = ?
  `, [`{${WEEKLY_NOTICE_SETTING}}`, user.id])
  const settings = user.get('settings') || {}
  user.set('settings', { ...settings, [WEEKLY_NOTICE_SETTING]: false })
}

/**
 * Runs the send for a digest payload. When the payload carries the line, a successful
 * send clears the flag and a failed one (false or an error) releases it. Resolves to
 * what the send resolved to.
 */
export async function settleWeeklyDigestNotice (user, data, send) {
  if (!data?.weekly_digest_notice) return send()
  let result
  try {
    result = await send()
  } catch (err) {
    releaseWeeklyDigestNotice(user)
    throw err
  }
  if (result === false) {
    releaseWeeklyDigestNotice(user)
    return result
  }
  try {
    await clearFlag(user)
  } catch (err) {
    // The digest went out; this run keeps the claim, so the line isn't repeated today
    sails.log.error(`digest2: could not clear the weekly digest notice for user ${user.id}: ${err.message}`)
  }
  return result
}
