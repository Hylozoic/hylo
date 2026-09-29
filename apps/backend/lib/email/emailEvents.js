/* global User */
// What Hylo does with the email provider's delivery events (D36):
//
//   bounce (type bounce)            a hard bounce: the address is marked undeliverable,
//                                   so non-essential email stops and the app asks the
//                                   person to fix it. 'blocked' bounces are temporary and ignored.
//   dropped (Bounced Address,       the provider refused to send to an address that
//            Invalid)               bounced before, or isn't valid: marked the same way
//   spamreport                      turns off that kind of email for the person, as a
//                                   one-click unsubscribe from it would. The kind comes
//                                   from the tags each send carries (Email.js). Without a
//                                   kind, or for email with no single switch, the person's
//                                   unsubscribe choice becomes "everything except direct",
//                                   unless they already made one.
//
// Nothing from the event is kept except a short reason (never the provider's message,
// which can quote the address).
import { uniq } from 'lodash'
import { emailTypeFor } from './emailTypes'
import applyUnsubscribe from './applyUnsubscribe'
import { UNSUBSCRIBE_SCOPE, UNSUBSCRIBE_SCOPE_SETTING, unsubscribeScopeOf } from '../../api/models/notification/rules/unsubscribeScope'

const UNDELIVERABLE_DROP_REASONS = ['Bounced Address', 'Invalid']

const addressesFor = email => uniq([email, email.toLowerCase()])

// The tags Email.js sends with every email, as the provider reports them (categories)
export function tagsFrom (category) {
  const tags = (Array.isArray(category) ? category : [category]).filter(tag => typeof tag === 'string')
  const valueOf = prefix => {
    const tag = tags.find(t => t.startsWith(prefix))
    return tag ? tag.slice(prefix.length) : null
  }
  const frequency = valueOf('hylo_frequency:')
  return {
    sender: valueOf('hylo_type:'),
    groupId: valueOf('hylo_group:'),
    frequency: ['daily', 'weekly'].includes(frequency) ? frequency : null
  }
}

function bounceReason (event) {
  const classification = typeof event.bounce_classification === 'string' ? event.bounce_classification.slice(0, 100) : null
  return classification ? `bounce: ${classification}` : 'bounce'
}

async function handleComplaint (email, event) {
  const user = await User.query(q => q.whereIn('email', addressesFor(email))).fetch()
  if (!user) return false

  const { sender, groupId, frequency } = tagsFrom(event.category)
  const type = sender ? emailTypeFor(sender) : null
  // A complaint about essential email (a receipt, a password reset) changes no setting
  if (type?.kind === 'essential') return false

  if (type?.unsubscribe && type.unsubscribe !== 'settings_page') {
    const result = await applyUnsubscribe(user, { descriptor: type.unsubscribe, groupId, frequency })
    if (result.applied) return true
  }

  if (unsubscribeScopeOf(user)) return false
  await user.addSetting({ [UNSUBSCRIBE_SCOPE_SETTING]: UNSUBSCRIBE_SCOPE.ALL_BUT_DIRECT }, true)
  return true
}

// Returns true when the event changed something
export async function handleEmailEvent (event) {
  const email = typeof event?.email === 'string' ? event.email.trim() : null
  if (!email) return false

  switch (event.event) {
    case 'bounce':
      if (event.type && event.type !== 'bounce') return false
      return (await User.markEmailUndeliverable(email, bounceReason(event))) > 0
    case 'dropped':
      if (!UNDELIVERABLE_DROP_REASONS.includes(event.reason)) return false
      return (await User.markEmailUndeliverable(email, `dropped: ${event.reason}`)) > 0
    case 'spamreport':
      return handleComplaint(email, event)
    default:
      return false
  }
}
