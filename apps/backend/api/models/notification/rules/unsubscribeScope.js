// The "Unsubscribe" choices on the emailed settings page (D35), saved on the user as
// settings.email_unsubscribe_scope. Other code reads that value, so its four values
// are a contract:
//
//   digest_only      "Fewer emails (digest only)". Digests keep coming; email about each
//                    new post, and other ambient email, stops.
//   no_group_emails  "No group emails". Choosing it turns off sendEmail on every
//                    membership (UserController), so group digests and group email stop.
//                    Direct messages still email.
//   all_but_direct   "Everything except direct" (preselected). Direct signals (direct
//                    messages, mentions and replies to you) still email and push. Group
//                    and chat digests, comment digests on posts you follow (apart from
//                    mentions and replies) and all other non-essential email and push
//                    stop. Nothing is written to memberships, so group settings still
//                    decide where direct signals go.
//   everything       "Everything". All non-essential email and push stop, as the old
//                    "Unsubscribe from all" did.
//
// Essential email (lib/email/emailTypes.js: receipts, password resets, verification,
// payment-failed and renewal reminders, account confirmations) is never affected.
// In-app notifications are never affected.
import { CHANNEL, SIGNAL_CLASS } from '../signalClasses'

export const UNSUBSCRIBE_SCOPE = {
  DIGEST_ONLY: 'digest_only',
  NO_GROUP_EMAILS: 'no_group_emails',
  ALL_BUT_DIRECT: 'all_but_direct',
  EVERYTHING: 'everything'
}

export const UNSUBSCRIBE_SCOPES = Object.values(UNSUBSCRIBE_SCOPE)

// The key on users.settings
export const UNSUBSCRIBE_SCOPE_SETTING = 'email_unsubscribe_scope'

export const isUnsubscribeScope = value => UNSUBSCRIBE_SCOPES.includes(value)

// The scope saved on this user (a User model or a plain settings object), or null
export function unsubscribeScopeOf (userOrSettings) {
  const settings = typeof userOrSettings?.get === 'function'
    ? userOrSettings.get('settings')
    : userOrSettings
  const scope = settings?.[UNSUBSCRIBE_SCOPE_SETTING]
  return isUnsubscribeScope(scope) ? scope : null
}

// Whether an activity's reasons include a mention of its reader
export const mentionsReader = reasons => (reasons || []).some(reason => /^mention/.test(reason))

// Direct for this reader: its class is direct, or it mentions them. An announcement that
// mentions you is classed by its announcement (the higher priority reason), and is still
// a mention.
export const isDirectSignal = ctx =>
  ctx.signalClass === SIGNAL_CLASS.DIRECT || mentionsReader(ctx.reasons)

// Scopes under which only direct signals still reach the person by email and push
export const keepsOnlyDirect = scope =>
  scope === UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT || scope === UNSUBSCRIBE_SCOPE.EVERYTHING

// Scopes that stop group digests (daily, weekly and unified) and hourly chat digests.
// no_group_emails stops them through each membership's sendEmail instead.
export const stopsGroupDigests = keepsOnlyDirect

// Reader filter (notification/rules READER_FILTERS)
export function unsubscribeScopeFilter (ctx) {
  const scope = unsubscribeScopeOf(ctx.reader)
  if (!scope) return

  switch (scope) {
    case UNSUBSCRIBE_SCOPE.EVERYTHING:
      ctx.channels.delete(CHANNEL.EMAIL)
      ctx.channels.delete(CHANNEL.PUSH)
      break
    case UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT:
      if (!isDirectSignal(ctx)) {
        ctx.channels.delete(CHANNEL.EMAIL)
        ctx.channels.delete(CHANNEL.PUSH)
      }
      break
    case UNSUBSCRIBE_SCOPE.DIGEST_ONLY:
      if (ctx.signalClass === SIGNAL_CLASS.AMBIENT && !isDirectSignal(ctx)) ctx.channels.delete(CHANNEL.EMAIL)
      break
    // no_group_emails is already in each membership's sendEmail
  }
}

// Whether a bulk (non-essential) email of this type may go to someone with this scope.
// Email.js asks this for every non-essential send, so it also covers email that does not
// come from a notification (welcome, win-back, group closed and so on). `type` is the
// sender's lib/email/emailTypes.js line (null when the sender is not listed yet).
// `context.direct` marks one send as direct when its sender usually isn't, such as an
// announcement that mentions the reader.
export function scopeAllowsBulkEmail (scope, type, context = {}) {
  if (type?.kind === 'essential') return true
  switch (scope) {
    case UNSUBSCRIBE_SCOPE.EVERYTHING:
      return false
    case UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT:
      // Senders marked direct only carry direct content for these readers (the comment
      // and chat digests are narrowed to mentions and replies before they are sent)
      return type?.direct === true || context?.direct === true
    default:
      return true
  }
}
