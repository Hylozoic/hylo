// The one-click unsubscribe token for a bulk email (D34): signed like the settings-page
// token (lib/HyloJWT), for one recipient and one kind of email. It names the recipient,
// the sender and what an unsubscribe switches off (the sender's descriptor in
// lib/email/emailTypes.js, with the group or digest frequency it applies to).
//
// The email's List-Unsubscribe header and its unsubscribe link carry only this token.
import { decodeHyloJWT, generateHyloJWT } from '../HyloJWT'
import { isValidUnsubscribe } from './emailTypes'

export const UNSUBSCRIBE_ACTION = 'email_unsubscribe'

// Mailbox providers may use a one-click link long after the email arrived
export const UNSUBSCRIBE_TOKEN_DAYS = 60

const FREQUENCIES = ['daily', 'weekly']

// A weekly unified digest can also carry the groups whose daily digest was slowed down
// for being away (D9). Its token (claim sd) and its tag say so, so that unsubscribing
// from it, or reporting it as spam, also covers those daily groups.
export const SLOWED_DAILY_TAG = 'hylo_slowed_daily'

const baseUrl = () => `${process.env.PROTOCOL}://${process.env.DOMAIN}`

export function createUnsubscribeToken ({ userId, sender, descriptor, groupId, frequency, slowedDaily }) {
  if (!userId || !isValidUnsubscribe(descriptor)) return null
  const claims = {
    action: UNSUBSCRIBE_ACTION,
    exp: Math.floor(Date.now() / 1000) + UNSUBSCRIBE_TOKEN_DAYS * 24 * 60 * 60,
    ud: descriptor
  }
  if (sender) claims.et = sender
  if (groupId) claims.gid = String(groupId)
  if (FREQUENCIES.includes(frequency)) claims.freq = frequency
  if (slowedDaily && frequency === 'weekly') claims.sd = 1
  return generateHyloJWT(String(userId), claims)
}

// { userId, sender, descriptor, groupId, frequency, slowedDaily }, or null for a token
// that is missing, tampered with, expired or made for something else
export function readUnsubscribeToken (token) {
  if (!token || typeof token !== 'string') return null
  let claims
  try {
    claims = decodeHyloJWT(token)
  } catch (err) {
    return null
  }
  if (!claims || claims.action !== UNSUBSCRIBE_ACTION || !claims.sub || !isValidUnsubscribe(claims.ud)) return null
  return {
    userId: String(claims.sub),
    sender: claims.et || null,
    descriptor: claims.ud,
    groupId: claims.gid || null,
    frequency: FREQUENCIES.includes(claims.freq) ? claims.freq : null,
    slowedDaily: claims.sd === 1 && claims.freq === 'weekly'
  }
}

// The address mailbox providers POST to (RFC 8058). A GET of it only redirects to the
// confirmation page.
export const oneClickUrl = token =>
  `${baseUrl()}/noo/email/unsubscribe?token=${encodeURIComponent(token)}`

// The page an unsubscribe link in the email opens. Nothing changes until its button is pressed.
export const confirmPageUrl = token =>
  `${baseUrl()}/email/unsubscribe?token=${encodeURIComponent(token)}`
