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
  MESSAGE_SENT: 'message_sent'
}

const COLUMNS = ['occurred_at', 'event_type', 'user_id', 'group_id', 'object_type', 'object_id', 'target_user_id', 'post_type', 'platform', 'properties', 'source']

/*
 * Builds one activity_events row per group the action landed in (or a single
 * group_id 0 row when it isn't group-scoped). Returns [] without a type or user.
 */
export function buildEventRows ({ type, userId, groupIds = [], object = {}, targetUserId = null, postType = null, platform = null, properties = null, occurredAt = new Date(), source = 'live' }) {
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
