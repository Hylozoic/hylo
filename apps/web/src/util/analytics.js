import mixpanel from 'mixpanel-browser'
import config, { isProduction, isTest } from 'config/index'
import { isSandboxMode } from 'sandbox/isSandbox'
import { getCookieConsent } from 'util/cookieConsent'

let initialized = false
// The person identified to Mixpanel on this page, whose profile an explicit
// rejection deletes
let identifiedUserId = null

/**
 * The analytics choice to honour: this browser's cookie, else the one saved on
 * the account. true or false once answered, null when never answered, and
 * undefined while it can't be known yet: a browser without the cookie (a new
 * device, or one cleared or expired) only learns the account's choice when
 * CheckLogin or MeQuery loads cookieConsentPreferences, which is null when
 * none was saved.
 */
export function resolveAnalyticsChoice (cookieConsent, accountPreferences) {
  if (typeof cookieConsent?.analytics === 'boolean') return cookieConsent.analytics
  if (accountPreferences === undefined) return undefined
  const saved = accountPreferences?.settings?.analytics
  return typeof saved === 'boolean' ? saved : null
}

/**
 * Whether analytics calls may be made under a choice from
 * resolveAnalyticsChoice. Only an explicit rejection turns them off: people who
 * have not answered the cookie panel keep today's behaviour. Nothing is allowed
 * while the choice is still unknown.
 */
export function analyticsAllowed (choice) {
  return choice !== undefined && choice !== false && !isSandboxMode() && !!config.mixpanel.token
}

/**
 * Initializes Mixpanel once, and opts out right away when the stored consent
 * already rejects analytics, so nothing is sent before the consent UI loads.
 */
export function initAnalytics () {
  if (initialized || isTest || isSandboxMode() || !config.mixpanel.token) return
  mixpanel.init(config.mixpanel.token, { debug: !isProduction })
  initialized = true
  applyAnalyticsConsent(getCookieConsent())
}

/**
 * Mirrors a consent choice into Mixpanel's own opt-out, which makes the SDK drop
 * every call and stop writing its cookie. Only an answered choice changes
 * anything, and only when it differs from the SDK's current state.
 *
 * `explicit` marks a choice the person is making right now (the cookie panel or
 * the analytics setting). Rejecting then also deletes the Mixpanel profile of
 * the person identified on this page (the server deletes it too, for the
 * signed-in account). A stored choice replayed at startup, from the account or
 * at login only stops sending, so it doesn't re-issue a deletion.
 */
export function applyAnalyticsConsent (consent, { explicit = false } = {}) {
  if (!initialized || typeof consent?.analytics !== 'boolean') return
  const optedOut = mixpanel.has_opted_out_tracking()
  if (consent.analytics === false && !optedOut) {
    if (explicit) deleteIdentifiedProfile()
    mixpanel.opt_out_tracking({ delete_user: false })
  } else if (consent.analytics === true && optedOut) {
    mixpanel.opt_in_tracking()
  }
}

// Only someone identified on this page has a profile the browser can delete.
// Mixpanel batches requests, and opting out stops and empties those batches,
// which would drop a queued deletion, so batching is switched off first and
// the deletion goes out straight away.
function deleteIdentifiedProfile () {
  if (!identifiedUserId) return
  mixpanel.stop_batch_senders()
  mixpanel.people.delete_user()
}

/** Identifies the signed-in person to Mixpanel; callers check the choice first. */
export function identifyAnalytics (userId) {
  mixpanel.identify(userId)
  identifiedUserId = userId
}

// Callers re-run on a new choice before CookieConsentProvider's effect applies
// it, and an SDK that is still opted out silently drops their calls
function applyChoiceAndCheck (choice) {
  applyAnalyticsConsent({ analytics: choice })
  return analyticsAllowed(choice)
}

/** Identifies the signed-in person and records their profile, when the choice allows it. */
export function identifyAnalyticsUser (user, choice) {
  if (!user?.id || !applyChoiceAndCheck(choice)) return
  identifyAnalytics(user.id)
  mixpanel.people.set({
    $name: user.name,
    $email: user.email,
    $location: user.location
  })
}

/** Records the person's group memberships and the current group's profile, when the choice allows it. */
export function setAnalyticsGroups (memberships, currentGroup, choice) {
  if (!applyChoiceAndCheck(choice)) return
  mixpanel.set_group('groupId', memberships.map(m => m.group.id))
  if (currentGroup?.id) {
    mixpanel.get_group('groupId', currentGroup.id).set({
      $location: currentGroup.location,
      $name: currentGroup.name,
      type: currentGroup.type
    })
  }
}
