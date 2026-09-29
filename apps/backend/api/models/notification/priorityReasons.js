// In priority order: Notification.priorityReason returns the first label that one of an
// activity's reasons starts with
export const PRIORITY_REASONS = [
  'donation to',
  'donation from',
  'announcement',
  'eventInvitation',
  'mention',
  'commentMention',
  'newComment',
  'newContribution',
  'chat',
  'tag',
  'newPost',
  'follow',
  'followAdd',
  'unfollow',
  'postFulfilled',
  'postUnfulfilled',
  'joinRequest',
  'approvedJoinRequest',
  'groupInvitation',
  'groupChildGroupInviteAccepted',
  'groupChildGroupInvite',
  'groupParentGroupJoinRequestAccepted',
  'groupParentGroupJoinRequest',
  'groupPeerGroupInviteAccepted',
  'groupPeerGroupInvite',
  'memberJoinedGroup',
  'trackCompleted',
  'trackEnrollment',
  'fundingRoundNewSubmission',
  'fundingRoundPhaseTransition',
  'fundingRoundReminder',
  // D14: to the person who asked to join. Named so no earlier label is a prefix of them
  'acknowledgedJoinRequest',
  'declinedJoinRequest',
  'unansweredJoinRequest',
  // D48: a steward gave you a role or badge
  'roleGranted',
  // D38: weekly "N people joined, say hi" (group/newcomerBatch.js)
  'newMembersJoined',
  // D49 experiment: a newcomer's first post has no response (post/firstPostNudge.js)
  'firstPostUnanswered'
]
