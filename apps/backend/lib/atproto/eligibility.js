/**
 * Who may get a Hylo-hosted AT Protocol identity during the experiment:
 * active users with a verified email on one of the allowed domains (hylo.com, terran.io).
 */
import { atprotoConfig } from './config'

const emailDomain = email => (email || '').trim().toLowerCase().split('@')[1] || null

/**
 * Returns why `user` can't have an identity, or null if they can.
 */
export function atprotoIneligibilityReason (user, config = atprotoConfig()) {
  if (!user) return 'no such user'
  if (user.get('active') === false) return 'user is not active'
  if (user.get('email_validated') !== true) return 'email is not verified'
  if (!config.allowedEmailDomains.includes(emailDomain(user.get('email')))) {
    return `email domain is not one of: ${config.allowedEmailDomains.join(', ') || '(none configured)'}`
  }
  return null
}

export function isEligibleForAtprotoIdentity (user, config = atprotoConfig()) {
  return atprotoIneligibilityReason(user, config) === null
}
