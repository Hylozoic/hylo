import mixpanel from 'mixpanel-browser'
import config, { isProduction, isTest } from 'config/index'
import { isSandboxMode } from 'sandbox/isSandbox'
import { getCookieConsent } from 'util/cookieConsent'

let initialized = false

/**
 * Whether analytics calls may be made. Only an explicit rejection turns them
 * off: people who have not answered the cookie panel keep today's behaviour.
 */
export function analyticsAllowed () {
  return !isSandboxMode() && !!config.mixpanel.token && getCookieConsent()?.analytics !== false
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
 */
export function applyAnalyticsConsent (consent) {
  if (!initialized || typeof consent?.analytics !== 'boolean') return
  const optedOut = mixpanel.has_opted_out_tracking()
  if (consent.analytics === false && !optedOut) {
    // Deleting the existing profile is a separate decision; this only stops sending
    mixpanel.opt_out_tracking({ delete_user: false })
  } else if (consent.analytics === true && optedOut) {
    mixpanel.opt_in_tracking()
  }
}

/** Identifies the signed-in person and records their profile, when allowed. */
export function identifyAnalyticsUser (user) {
  if (!user?.id || !analyticsAllowed()) return
  mixpanel.identify(user.id)
  mixpanel.people.set({
    $name: user.name,
    $email: user.email,
    $location: user.location
  })
}

/** Records the person's group memberships and the current group's profile, when allowed. */
export function setAnalyticsGroups (memberships, currentGroup) {
  if (!analyticsAllowed()) return
  mixpanel.set_group('groupId', memberships.map(m => m.group.id))
  if (currentGroup?.id) {
    mixpanel.get_group('groupId', currentGroup.id).set({
      $location: currentGroup.location,
      $name: currentGroup.name,
      type: currentGroup.type
    })
  }
}
