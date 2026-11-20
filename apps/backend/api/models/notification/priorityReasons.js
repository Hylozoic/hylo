// In priority order: Notification.priorityReason returns the first label that one of an
// activity's reasons starts with
export const PRIORITY_REASONS = [
  'donation to', 'donation from', 'announcement', 'eventInvitation', 'mention', 'commentMention', 'newComment', 'newContribution', 'chat', 'tag',
  'newPost', 'follow', 'followAdd', 'unfollow', 'postFulfilled', 'postUnfulfilled', 'joinRequest', 'approvedJoinRequest', 'groupInvitation', 'groupChildGroupInviteAccepted', 'groupChildGroupInvite',
  'groupParentGroupJoinRequestAccepted', 'groupParentGroupJoinRequest', 'groupPeerGroupInviteAccepted', 'groupPeerGroupInvite', 'memberJoinedGroup', 'trackCompleted', 'trackEnrollment',
  'fundingRoundNewSubmission', 'fundingRoundPhaseTransition', 'fundingRoundReminder'
]
