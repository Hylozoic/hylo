/**
 * Mixpanel events sent from the server, only for people who haven't turned
 * analytics off.
 *
 * The rule matches the web app: an explicit "no" to analytics stops the event,
 * and people who never answered the cookie panel keep today's behaviour (not
 * answered means allowed). A "no" counts from either place it can be stored:
 * the person's latest choice saved on their account (CookieConsent), or, for
 * the person making the request, the choice in their browser's consent cookie.
 *
 * Nothing is sent when Mixpanel is disabled (no token, and always in tests),
 * and a failure here is logged and never breaks the caller.
 */
import mixpanel from '../mixpanel'

// The cookie the web app keeps the visitor's choice in (apps/web/src/util/cookieConsent.js)
export const CONSENT_COOKIE_NAME = 'hylo_cookie_consent'

// Server events that aren't in AnalyticsEvents (@hylo/shared); the names are kept from before
export const ServerAnalyticsEvents = {
  COMMENT_ADDED_BY_EMAIL: 'Post: Comment: Add by Email',
  SIGNUP_SUCCESS: 'Signup success'
}

/**
 * The analytics choice in the request's consent cookie: true or false, or
 * undefined when there's no readable answer.
 */
export function browserAnalyticsChoice (req) {
  try {
    const raw = req?.cookies?.[CONSENT_COOKIE_NAME]
    if (!raw) return undefined
    const consent = typeof raw === 'string' ? JSON.parse(raw) : raw
    return typeof consent?.analytics === 'boolean' ? consent.analytics : undefined
  } catch (err) {
    return undefined
  }
}

/**
 * Which app a request came from, as the signup event has always reported it.
 */
export function requestPlatform (req) {
  const headers = req?.headers || {}
  if (headers['ios-version']) return 'ios'
  if (headers['android-version']) return 'android'
  return 'Web'
}

function normalizeIds (userIds) {
  return [...new Set((userIds || [])
    .filter(id => id !== null && id !== undefined && id !== '')
    .map(String))]
}

function logError (eventName, err) {
  const message = `trackServerEvent(${eventName}) failed: ${err?.message || err}`
  if (global.sails?.log?.error) sails.log.error(message)
  else console.error(message)
}

/**
 * Sends one event per user, for the users whose latest saved choice doesn't
 * reject analytics, with a single consent query for the whole list.
 * `properties` is an object, or a function of the user id (as a string) that
 * returns one. Resolves to the ids the event was sent for.
 */
export async function trackServerEventForUsers (userIds, eventName, properties = {}) {
  if (mixpanel.disabled || !eventName) return []
  const ids = normalizeIds(userIds)
  if (ids.length === 0) return []

  try {
    const choices = await CookieConsent.latestAnalyticsChoices(ids)
    const allowed = ids.filter(id => choices.get(id) !== false)
    for (const id of allowed) {
      const props = typeof properties === 'function' ? properties(id) : properties
      mixpanel.track(eventName, { ...props, distinct_id: id })
    }
    return allowed
  } catch (err) {
    logError(eventName, err)
    return []
  }
}

/**
 * Sends one event for one user unless they rejected analytics. Pass the
 * request (`{ req }`) when that user is the one making it, so the choice in
 * their browser also counts, which matters before a new account has a choice
 * saved on it. Resolves to whether the event was sent.
 */
export async function trackServerEvent (userId, eventName, properties = {}, { req } = {}) {
  if (mixpanel.disabled || !eventName) return false
  if (req && browserAnalyticsChoice(req) === false) return false
  const sent = await trackServerEventForUsers([userId], eventName, properties)
  return sent.length > 0
}

export default trackServerEvent
