/**
 * Who may get a Hylo-hosted AT Protocol identity during the experiment:
 * active users with a verified email on one of the allowed domains (hylo.com, terran.io).
 */
import { atprotoConfig } from './config'

const emailDomain = email => (email || '').trim().toLowerCase().split('@')[1] || null

export function isEligibleForAtprotoIdentity (user, config = atprotoConfig()) {
  if (!user || user.get('active') === false) return false
  if (user.get('email_validated') !== true) return false
  return config.allowedEmailDomains.includes(emailDomain(user.get('email')))
}
