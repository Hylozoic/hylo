// One line per Email.js sender: whether it is essential or bulk, and what a one-click
// unsubscribe from it should switch off.
//
// kind
//   essential  account, security, payment and receipt email, and email someone asked
//              for. Never carries a one-click unsubscribe and is never silenced by
//              "unsubscribe from all" (D34, D35).
//   bulk       everything else. Carries List-Unsubscribe; one-click stops only that kind
//              of email (D34).
//
// unsubscribe (bulk only; null for essential). The kinds email-prefs-delivery
// implements:
//   group_digest               that group's email digest (digestFrequency 'never'); for
//                              a space, the parent group's membership (D72)
//   group_post_email           that group's per-post email (membership sendEmail)
//   comment_email              the user's comment email setting (comment_notifications)
//   dm_email                   the user's direct message email setting (dm_notifications)
//   membership_setting:<key>   a named membership setting, e.g. membership_setting:sendEmail
//   settings_page              no single switch; links to the notification settings page
//
// direct (bulk only) marks email that carries direct signals (D7: direct messages,
// mentions, replies to you, event invitations). It still reaches people who chose
// "everything except direct" on the emailed settings page (D35); other bulk email
// doesn't (notification/rules/unsubscribeScope.js).
//
// Senders added by other packages are classified by email-prefs-delivery when they
// report them, so a sender missing from this table is not an error here.

const essential = note => ({ kind: 'essential', unsubscribe: null, note })
const bulk = (unsubscribe, note) => ({ kind: 'bulk', unsubscribe, note })
const bulkDirect = (unsubscribe, note) => ({ kind: 'bulk', unsubscribe, note, direct: true })

export const EMAIL_TYPES = {
  sendSimpleEmail: bulk('group_digest', 'group and saved-search digests (lib/group/digest2); also a legacy import welcome'),
  sendRawEmail: essential('internal notice to the team about a new group'),
  sendPasswordReset: essential('password reset'),
  sendEmailVerification: essential('email verification code'),
  sendFinishRegistration: essential('finish signing up'),
  sendModerationAction: essential('a moderator acted on your post'),
  sendInvitation: essential('invitation to someone who is not a member yet'),
  sendTagInvitation: essential('unused invitation template'),
  sendPostNotification: bulk('group_post_email', 'new post or announcement'),
  // A mention is a direct signal (D7, D8): a one-click from it must not switch off the
  // group's post email, which would also stop later mentions there. email-prefs-delivery
  // decides the final switch.
  sendPostMentionNotification: bulkDirect('settings_page', 'mentioned in a post'),
  sendJoinRequestNotification: bulk('group_post_email', 'join request, to stewards'),
  sendApprovedJoinRequestNotification: bulk('group_post_email', 'your join request was approved'),
  sendMemberJoinedGroupNotification: bulk('group_post_email', 'new member, to stewards'),
  sendDonationToEmail: essential('receipt for your contribution'),
  sendDonationFromEmail: essential('someone contributed to your project'),
  sendEventInvitationEmail: bulkDirect('group_post_email', 'invited to an event'),
  sendEventRsvpEmail: essential('calendar invite for an event you responded to'),
  sendEventRsvpUpdateEmail: essential('calendar update for an event you responded to'),
  sendEventRsvpCancelEmail: essential('calendar cancellation for an event you responded to'),
  sendGroupChildGroupInviteNotification: bulk('group_post_email', 'group invited to join a parent group'),
  sendGroupChildGroupInviteAcceptedNotification: bulk('group_post_email', 'group joined a parent group'),
  sendGroupParentGroupJoinRequestNotification: bulk('group_post_email', 'group asked to join your group'),
  sendGroupParentGroupJoinRequestAcceptedNotification: bulk('group_post_email', 'group join request accepted'),
  sendGroupPeerGroupInviteNotification: bulk('group_post_email', 'peer group invitation'),
  sendGroupPeerGroupInviteAcceptedNotification: bulk('group_post_email', 'peer group invitation accepted'),
  sendExportMembersList: essential('member list export you requested'),
  sendExportUserAccount: essential('account export you requested'),
  sendTrackCompletedEmail: bulk('group_post_email', 'someone completed your track'),
  sendTrackEnrollmentEmail: bulk('group_post_email', 'someone enrolled in your track'),
  sendTrackReminderEmail: bulk('group_post_email', 'reminder to continue a track you enrolled in (D63)'),
  sendWelcomeEmail: bulk('settings_page', 'welcome after signing up'),
  sendGroupCreatedEmail: essential('the group you just created'),
  sendFundingRoundNewSubmissionEmail: bulk('group_post_email', 'new funding round submission'),
  sendFundingRoundPhaseTransitionEmail: bulk('group_post_email', 'funding round phase changed'),
  sendFundingRoundReminderEmail: bulk('group_post_email', 'funding round deadline reminder'),
  sendStripeAlertEmail: essential('payment account alert'),
  sendNewStripeConnectedAccountAdminNotification: essential('payment account connected, to admins'),
  sendPurchaseConfirmation: essential('purchase receipt'),
  // D84: only receipts and the payment-failed and renewal reminders are essential; the
  // other paid-content notices are bulk, with no single switch to turn off
  sendAccessGranted: bulk('settings_page', 'you were given access to paid content'),
  // D84: transactional and essential, as a later trial-ending reminder (D65) will be
  sendSubscriptionRenewalReminder: essential('subscription renewal reminder (D84)'),
  sendSubscriptionRenewed: essential('subscription renewal receipt'),
  sendPaymentFailed: essential('payment failed (D84)'),
  sendRefundProcessed: essential('refund receipt'),
  sendSubscriptionCancelled: bulk('settings_page', 'subscription cancelled (D84)'),
  sendSubscriptionCancelledAdminNotification: bulk('settings_page', 'subscription cancelled, to admins (D84)'),
  sendNewSubscriberAdminNotification: bulk('settings_page', 'new subscriber, to admins (D62)'),
  sendAccessExpired: bulk('settings_page', 'paid access ended (D84)'),
  sendTrackAccessPurchased: essential('track purchase receipt'),
  sendMessageDigest: bulkDirect('dm_email', 'direct message digest'),
  // Narrowed to mentions and replies for readers who chose everything except direct
  sendCommentDigest: bulkDirect('comment_email', 'comment digest, including "You were mentioned in"'),
  // Narrowed to mentions for readers who chose everything except direct
  sendChatDigest: bulkDirect('group_digest', 'hourly chat digest (D72)'),
  sendAccountClosed: essential('your account was deactivated or deleted (D70)'),
  sendGroupClosed: bulk('settings_page', 'a group you were in was closed'),
  sendStalledSignupReminder: bulk('settings_page', 'reminder to finish signing up'),
  sendWinbackEmail: bulk('settings_page', 'one email after 180 days away (D9)')
}

export const EMAIL_KINDS = ['essential', 'bulk']

export const UNSUBSCRIBE_KINDS = [
  'group_digest',
  'group_post_email',
  'comment_email',
  'dm_email',
  'settings_page'
]

export function isValidUnsubscribe (descriptor) {
  if (UNSUBSCRIBE_KINDS.includes(descriptor)) return true
  return /^membership_setting:[A-Za-z]+$/.test(descriptor || '')
}

export function emailTypeFor (sender) {
  return EMAIL_TYPES[sender] || null
}
