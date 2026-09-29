// Every notification is one kind of signal (D7), and the kind decides which channels it
// may use. Activity.generateNotificationMedia reads this table through
// notification/rules; later rules filter by class (for example an inactivity throttle
// or a scoped unsubscribe that must never silence direct signals).
//
//   direct       someone speaking to you: DMs, mentions, replies to you
//   social       feedback on what you made: reactions, RSVPs, votes, follows
//   ambient      what's happening around you: new posts, chats, joins
//   operational  account and membership business: join requests, approvals, receipts
//   lifecycle    nudges based on what you have or haven't done yet
//
// A class sets the ceiling. The reader's group toggles (sendEmail and
// sendPushNotifications) and their post setting still apply on top, and a reason only
// emails when Notification#sendEmail has an email for it (EMAIL_REASONS).
//
// A line that sets its own `channels` overrides its class. Cards that decided their
// own channels take precedence over the class table (for example D46: vote notices to
// authors are in-app only; D57: a project creator gets a push when someone joins).
//
// Parity: no existing reason changes channels because of this table. Where a class's
// ceiling is narrower than what a reason already did, the line keeps the old channels
// explicitly until its own card changes them. test/unit/models/notification/
// signalClasses.test.js holds the snapshot.

export const SIGNAL_CLASS = {
  DIRECT: 'direct',
  SOCIAL: 'social',
  AMBIENT: 'ambient',
  OPERATIONAL: 'operational',
  LIFECYCLE: 'lifecycle'
}

export const CHANNEL = {
  IN_APP: 'inApp',
  PUSH: 'push',
  EMAIL: 'email'
}

const { DIRECT, SOCIAL, AMBIENT, OPERATIONAL, LIFECYCLE } = SIGNAL_CLASS
const { IN_APP, PUSH, EMAIL } = CHANNEL
const ALL_CHANNELS = [IN_APP, PUSH, EMAIL]

// Ambient keeps email and push for readers who asked for every post ("All posts").
// D7's "in-app plus the digest" for ambient signals comes from the post setting
// (Important by default) rather than from this ceiling.
export const CLASS_CHANNELS = {
  [DIRECT]: ALL_CHANNELS,
  [SOCIAL]: [IN_APP, PUSH],
  [AMBIENT]: ALL_CHANNELS,
  [OPERATIONAL]: ALL_CHANNELS,
  [LIFECYCLE]: ALL_CHANNELS
}

// One line per priority reason (see priorityReasons.js).
export const REASON_SIGNALS = {
  'donation to': { class: OPERATIONAL },
  'donation from': { class: OPERATIONAL },
  announcement: { class: AMBIENT },
  eventInvitation: { class: DIRECT },
  mention: { class: DIRECT },
  commentMention: { class: DIRECT },
  // A comment on a post you follow. classForActivity upgrades it to direct when it
  // replies to you (on your post, or under your comment).
  newComment: { class: SOCIAL },
  newContribution: { class: DIRECT },
  // Chats go out in the hourly chat digest, never as one email per message (D88).
  chat: { class: AMBIENT, channels: [IN_APP, PUSH] },
  tag: { class: AMBIENT },
  newPost: { class: AMBIENT },
  follow: { class: SOCIAL },
  followAdd: { class: DIRECT },
  unfollow: { class: SOCIAL },
  postFulfilled: { class: OPERATIONAL },
  postUnfulfilled: { class: OPERATIONAL },
  joinRequest: { class: OPERATIONAL },
  approvedJoinRequest: { class: OPERATIONAL },
  groupInvitation: { class: OPERATIONAL },
  groupChildGroupInviteAccepted: { class: OPERATIONAL },
  groupChildGroupInvite: { class: OPERATIONAL },
  groupParentGroupJoinRequestAccepted: { class: OPERATIONAL },
  groupParentGroupJoinRequest: { class: OPERATIONAL },
  groupPeerGroupInviteAccepted: { class: OPERATIONAL },
  groupPeerGroupInvite: { class: OPERATIONAL },
  memberJoinedGroup: { class: AMBIENT },
  // Social by kind; keeps today's email until a card decides otherwise.
  trackCompleted: { class: SOCIAL, channels: ALL_CHANNELS },
  trackEnrollment: { class: SOCIAL, channels: ALL_CHANNELS },
  fundingRoundNewSubmission: { class: OPERATIONAL },
  fundingRoundPhaseTransition: { class: OPERATIONAL },
  fundingRoundReminder: { class: OPERATIONAL },
  // Someone joined through your invitation: in-app and push, never email (D47)
  invitationAccepted: { class: SOCIAL, channels: [IN_APP, PUSH] }
}

// A reason with no line (or no priority reason at all) keeps every channel, as before.
const UNCLASSIFIED = { class: null, channels: ALL_CHANNELS }

export function signalForReason (reason) {
  const signal = REASON_SIGNALS[reason]
  if (!signal) return UNCLASSIFIED
  return {
    class: signal.class,
    channels: signal.channels || CLASS_CHANNELS[signal.class]
  }
}

export function channelsForReason (reason) {
  return signalForReason(reason).channels
}

// True when the activity is a comment on the reader's own post or under the reader's
// own comment. Uses whatever relations are loaded; returns false when it can't tell.
export function isReplyToReader (activity) {
  const readerId = activity.get('reader_id')
  if (!readerId || !activity.get('comment_id')) return false
  const relations = activity.relations || {}
  const post = relations.post || relations.comment?.relations?.post
  const postAuthorId = post && typeof post.get === 'function' ? post.get('user_id') : null
  const parentAuthorId = relations.parentComment && typeof relations.parentComment.get === 'function'
    ? relations.parentComment.get('user_id')
    : null
  return [postAuthorId, parentAuthorId].some(id => id != null && String(id) === String(readerId))
}

export function classForActivity (activity, reason) {
  const signal = signalForReason(reason)
  if (reason === 'newComment' && isReplyToReader(activity)) return DIRECT
  return signal.class
}
