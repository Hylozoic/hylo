/**
 * Event types written to activity_events. Add new ones here so every writer
 * and the metric queries share one list.
 */
export const EVENT_TYPES = {
  POST_CREATED: 'post_created',
  COMMENT_CREATED: 'comment_created',
  REACTION_ADDED: 'reaction_added',
  EVENT_RSVP: 'event_rsvp',
  PROPOSAL_VOTE: 'proposal_vote',
  PROJECT_JOINED: 'project_joined',
  GROUP_JOINED: 'group_joined',
  GROUP_LEFT: 'group_left',
  JOIN_REQUEST_CREATED: 'join_request_created',
  JOIN_REQUEST_DECIDED: 'join_request_decided',
  INVITATION_SENT: 'invitation_sent',
  INVITATION_ACCEPTED: 'invitation_accepted',
  ROLE_GRANTED: 'role_granted',
  ROLE_REVOKED: 'role_revoked',
  GROUP_CREATED: 'group_created',
  SIGNUP_COMPLETED: 'signup_completed',
  ACCOUNT_DEACTIVATED: 'account_deactivated',
  ACCOUNT_DELETED: 'account_deleted',
  MESSAGE_SENT: 'message_sent',
  TRACK_CREATED: 'track_created',
  TRACK_PUBLISHED: 'track_published',
  TRACK_ENROLLED: 'track_enrolled',
  TRACK_COMPLETED: 'track_completed',
  TRACK_LEFT: 'track_left',
  POST_UPDATED: 'post_updated',
  TOPIC_CREATED: 'topic_created',
  USER_BLOCKED: 'user_blocked',
  USER_UNBLOCKED: 'user_unblocked',
  REACTION_REMOVED: 'reaction_removed',
  JOIN_REQUEST_CANCELED: 'join_request_canceled',
  SIGNUP_EMAIL_VERIFICATION_SENT: 'signup_email_verification_sent',
  SIGNUP_EMAIL_VERIFIED: 'signup_email_verified',
  SIGNUP_EMAIL_VERIFICATION_FAILED: 'signup_email_verification_failed',
  SIGNUP_REGISTERED: 'signup_registered',
  SIGNUP_AGREEMENTS_ACCEPTED: 'signup_agreements_accepted',
  WELCOME_WIZARD_STEP_VIEWED: 'welcome_wizard_step_viewed',
  WELCOME_WIZARD_STEP_SKIPPED: 'welcome_wizard_step_skipped',
  GROUP_WELCOME_PAGE_VIEWED: 'group_welcome_page_viewed',
  GROUP_WELCOME_COMPLETED: 'group_welcome_completed',
  POST_OPENED: 'post_opened',
  POST_SHARED: 'post_shared',
  LOGIN_WALL_HIT: 'login_wall_hit',
  PUBLIC_GROUP_VIEWED: 'public_group_viewed',
  INVITE_LINK_OPENED: 'invite_link_opened'
}

// Names the browser and the app are allowed to record. Server actions are not in this list.
export const CLIENT_EVENT_NAMES = {
  'Email Verification Sent': EVENT_TYPES.SIGNUP_EMAIL_VERIFICATION_SENT,
  'Email Verified': EVENT_TYPES.SIGNUP_EMAIL_VERIFIED,
  'Email Verification Failed': EVENT_TYPES.SIGNUP_EMAIL_VERIFICATION_FAILED,
  Registered: EVENT_TYPES.SIGNUP_REGISTERED,
  'Signup Agreements Accepted': EVENT_TYPES.SIGNUP_AGREEMENTS_ACCEPTED,
  'Welcome Wizard Step Viewed': EVENT_TYPES.WELCOME_WIZARD_STEP_VIEWED,
  'Welcome Wizard Step Skipped': EVENT_TYPES.WELCOME_WIZARD_STEP_SKIPPED,
  'Group Welcome Page Viewed': EVENT_TYPES.GROUP_WELCOME_PAGE_VIEWED,
  'Group Welcome Completed': EVENT_TYPES.GROUP_WELCOME_COMPLETED,
  'Post Opened': EVENT_TYPES.POST_OPENED,
  'Post Shared': EVENT_TYPES.POST_SHARED,
  'Login Wall Hit': EVENT_TYPES.LOGIN_WALL_HIT,
  'Public Group Viewed': EVENT_TYPES.PUBLIC_GROUP_VIEWED,
  'Invite Link Opened': EVENT_TYPES.INVITE_LINK_OPENED
}

const COLUMNS = ['occurred_at', 'event_type', 'user_id', 'group_id', 'object_type', 'object_id', 'target_user_id', 'post_type', 'platform', 'properties', 'source']

/*
 * Builds one activity_events row per group the action landed in (or a single
 * group_id 0 row when it isn't group-scoped). Returns [] without a type or user.
 */
export function buildEventRows ({ type, userId, groupIds = [], object = {}, targetUserId = null, postId = null, postType = null, platform = null, properties = null, occurredAt = new Date(), source = 'live' }) {
  if (!type || !userId) return []
  const ids = [...new Set(groupIds.filter(id => id !== null && id !== undefined).map(String))]
  return (ids.length ? ids : ['0']).map(groupId => ({
    occurred_at: occurredAt,
    event_type: type,
    user_id: userId,
    group_id: groupId,
    object_type: object.type || null,
    object_id: object.id || null,
    target_user_id: targetUserId,
    post_id: postId || null,
    post_type: postType,
    platform,
    properties: properties ? JSON.stringify(properties) : null,
    source
  }))
}

/*
 * Appends an action to activity_events. Call it after the action has been
 * saved and don't await it: tracking must never slow down or break the action,
 * so failures are logged and swallowed. Repeats of the same action are ignored.
 */
export function trackActivity (knex, event, { log = () => {} } = {}) {
  let rows
  try {
    rows = buildEventRows(event)
  } catch (err) {
    log(err)
    return Promise.resolve(0)
  }
  if (rows.length === 0) return Promise.resolve(0)

  return knex('activity_events')
    .insert(rows, COLUMNS)
    .onConflict(['event_type', 'object_id', 'user_id', 'group_id', 'occurred_at']).ignore()
    .then(() => rows.length)
    .catch(err => {
      log(err)
      return 0
    })
}
