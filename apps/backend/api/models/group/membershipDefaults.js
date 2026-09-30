// Notification settings a new membership starts with.
//
// D1: new memberships start on 'important' (which adapts to quiet groups and live
// conversations, D94) plus the group's default digest. Stewards can set the group's
// default to 'all' (groups.settings.default_post_notifications) next to the default
// digest frequency. Existing members keep their settings.
//
// D11: a person's saved choice to get less email keeps applying to memberships they get
// later (joining, invitations, auto-add), so joining a group doesn't quietly subscribe
// them again. It mirrors what each choice did to their memberships when they made it.
import {
  UNSUBSCRIBE_SCOPE,
  unsubscribeScopeOf
} from '../notification/rules/unsubscribeScope'

export const NOTIFICATION_SETTING_KEYS = ['postNotifications', 'digestFrequency', 'sendEmail', 'sendPushNotifications']

export const DEFAULT_POST_NOTIFICATIONS = 'important'
// What a steward can choose as the group default
export const GROUP_DEFAULT_POST_NOTIFICATIONS = ['important', 'all']

// From least to most
const POST_LEVELS = ['none', 'important', 'all']
const DIGEST_LEVELS = ['never', 'weekly', 'daily']

const settingsOf = modelOrSettings => typeof modelOrSettings?.get === 'function'
  ? modelOrSettings.get('settings') || {}
  : modelOrSettings || {}

// The group's defaults for a new membership
export function groupNotificationDefaults (group) {
  const settings = settingsOf(group)
  return {
    postNotifications: settings.default_post_notifications === 'all' ? 'all' : DEFAULT_POST_NOTIFICATIONS,
    digestFrequency: settings.default_digest_frequency === 'weekly' ? 'weekly' : 'daily',
    sendEmail: true,
    sendPushNotifications: true
  }
}

// The four user-level keys the old "Unsubscribe from all" wrote. Its scope (D35:
// everything except direct) covers it, so these values are not a request to stop
// in-app notices too.
export function isLegacyUnsubscribeAll (userSettings) {
  const settings = settingsOf(userSettings)
  return settings.digest_frequency === 'never' &&
    settings.post_notifications === 'none' &&
    settings.dm_notifications === 'none' &&
    settings.comment_notifications === 'none'
}

// What a person's saved choices allow at most on a membership they get later:
// { sendEmail: false, sendPushNotifications: false, digestFrequency, postNotifications },
// each only when a choice asks for it.
//   - "No group emails" turned email off on every membership, and "Everything" turned
//     off email and push; later memberships start the same way.
//   - "Everything except direct" and "Everything" keep group email off through the
//     saved scope, which also lets direct messages and mentions through (D7), so
//     nothing more is written for them.
//   - Otherwise a user-level digest frequency or post setting below the default (from
//     the emailed settings page) carries over.
export function lessEmailCaps (userSettings) {
  const settings = settingsOf(userSettings)
  const scope = unsubscribeScopeOf(settings)
  const caps = {}
  if (scope === UNSUBSCRIBE_SCOPE.NO_GROUP_EMAILS || scope === UNSUBSCRIBE_SCOPE.EVERYTHING) caps.sendEmail = false
  if (scope === UNSUBSCRIBE_SCOPE.EVERYTHING) caps.sendPushNotifications = false

  const scopeCoversIt = scope === UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT || scope === UNSUBSCRIBE_SCOPE.EVERYTHING
  if (!scopeCoversIt && !isLegacyUnsubscribeAll(settings)) {
    if (DIGEST_LEVELS.includes(settings.digest_frequency) && settings.digest_frequency !== 'daily') {
      caps.digestFrequency = settings.digest_frequency
    }
    if (POST_LEVELS.includes(settings.post_notifications) && settings.post_notifications !== 'all') {
      caps.postNotifications = settings.post_notifications
    }
  }
  return caps
}

const isLower = (levels, value, than) => levels.indexOf(value) < levels.indexOf(than)

// Lowers notification settings to the caps; never raises anything
export function applyCaps (settings, caps = {}) {
  const result = { ...settings }
  if (caps.sendEmail === false) result.sendEmail = false
  if (caps.sendPushNotifications === false) result.sendPushNotifications = false
  if (caps.digestFrequency && (result.digestFrequency == null || isLower(DIGEST_LEVELS, caps.digestFrequency, result.digestFrequency))) {
    result.digestFrequency = caps.digestFrequency
  }
  if (caps.postNotifications && (result.postNotifications == null || isLower(POST_LEVELS, caps.postNotifications, result.postNotifications))) {
    result.postNotifications = caps.postNotifications
  }
  return result
}

// Notification settings for a new membership: the group's defaults lowered by the
// person's less-email choices, with what the caller passes on top (for example an
// auto-added space member's parent settings, which already carry those choices)
export function newMembershipNotificationSettings (group, userSettings, callerSettings = {}) {
  const merged = applyCaps(groupNotificationDefaults(group), lessEmailCaps(userSettings))
  for (const key of NOTIFICATION_SETTING_KEYS) {
    if (callerSettings[key] != null) merged[key] = callerSettings[key]
  }
  return merged
}

// For a returning (reactivated) member: only the notification keys their membership is
// missing, filled the way a new membership would be
export function missingNotificationSettings (membershipSettings, group, userSettings) {
  const current = membershipSettings || {}
  const missing = NOTIFICATION_SETTING_KEYS.filter(key => current[key] == null)
  if (missing.length === 0) return {}
  const defaults = newMembershipNotificationSettings(group, userSettings)
  return missing.reduce((acc, key) => ({ ...acc, [key]: defaults[key] }), {})
}
