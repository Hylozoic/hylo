/* global Notification */
// Notices to someone who asked to join a group (D14): the acknowledgment, the neutral
// decline notice and the 14-day "no answer yet" note. They aren't a member, so no group
// membership settings apply, the same as a group invitation. Each one is in-app and by
// email.
//
// The 14-day note also suggests other groups to try, so it is not sent by email to
// someone who has turned email down with an unsubscribe choice (users.settings
// email_unsubscribe_scope, any value); they still get it in-app. The acknowledgment and
// the decline answer the person's own request and always go out.
export const NON_MEMBER_REQUESTER_REASONS = [
  'acknowledgedJoinRequest',
  'declinedJoinRequest',
  'unansweredJoinRequest'
]

// The acknowledgment and the decline answer the person's own request, and their emails
// are essential (lib/email/emailTypes.js), so the reader filters (unsubscribe choice,
// time away) don't narrow them. The 14-day note goes through the filters as usual.
export const OWN_REQUEST_ANSWER_REASONS = ['acknowledgedJoinRequest', 'declinedJoinRequest']

export const answersOwnRequest = reasons => OWN_REQUEST_ANSWER_REASONS.includes(reasons?.[0])

export const nonMemberRequesterOverride = ({ activity, reasons }) => {
  if (!NON_MEMBER_REQUESTER_REASONS.includes(reasons[0])) return
  if (reasons[0] === 'unansweredJoinRequest') {
    const reader = activity.relations?.reader
    const settings = reader && typeof reader.get === 'function' ? reader.get('settings') : null
    if (settings?.email_unsubscribe_scope) return [Notification.MEDIUM.InApp]
  }
  return [Notification.MEDIUM.InApp, Notification.MEDIUM.Email]
}
