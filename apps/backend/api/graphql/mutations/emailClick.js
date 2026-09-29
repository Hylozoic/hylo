import { RATE_LIMITED_ERROR, isRateLimited, recordAttempt } from '../../../lib/rateLimit'

// The kind-of-email tag (ctt) on links in Hylo's emails, e.g. 'digest_email'
const EMAIL_TYPE_PATTERN = /^[a-z0-9_]{1,64}$/

/**
 * Records one click on a link in a Hylo email, in Hylo's own database: the
 * kind of email, the signed-in person if there is one (from the session, never
 * from the link), and the time. Anyone can call it, so it is rate-limited per IP.
 */
export async function recordEmailClick (userId, { emailType } = {}, { ip } = {}) {
  const type = typeof emailType === 'string' ? emailType.trim().toLowerCase() : ''
  if (!EMAIL_TYPE_PATTERN.test(type)) return { success: false, error: 'invalid-email-type' }

  const identifiers = { ip }
  if (await isRateLimited('recordEmailClick', identifiers)) return { success: false, error: RATE_LIMITED_ERROR }
  await recordAttempt('recordEmailClick', identifiers)

  await bookshelf.knex('email_clicks').insert({
    email_type: type,
    user_id: userId || null,
    created_at: new Date()
  })

  return { success: true }
}
