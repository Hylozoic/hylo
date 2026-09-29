// Priority reasons (see Notification.priorityReason) that Notification#sendEmail has an
// email for. Keep in sync with its switch: an Email notification for any other reason is
// marked sent without sending anything. Comments are emailed by Comment.sendDigests.
export const EMAIL_REASONS = new Set([
  'announcement',
  'approvedJoinRequest',
  'donation to',
  'donation from',
  'eventInvitation',
  'groupChildGroupInvite',
  'groupChildGroupInviteAccepted',
  'groupParentGroupJoinRequest',
  'groupParentGroupJoinRequestAccepted',
  'groupPeerGroupInvite',
  'groupPeerGroupInviteAccepted',
  'joinRequest',
  'memberJoinedGroup',
  'mention',
  'newPost',
  'tag',
  'trackCompleted',
  'trackEnrollment',
  'postFulfilled',
  'postUnfulfilled',
  'fundingRoundNewSubmission',
  'fundingRoundPhaseTransition',
  'fundingRoundReminder',
  'eventReminder'
])
