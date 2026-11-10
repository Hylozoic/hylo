import { trackActivity, EVENT_TYPES } from './trackActivity'
import { currentPlatform } from './requestContext'

export { EVENT_TYPES }

function log (err) {
  if (typeof sails !== 'undefined' && sails.log) {
    sails.log.error('Could not record activity event', err)
  }
}

/**
 * Appends an action to the activity log. Call it after the action is saved and
 * don't await it: a tracking failure is logged and never breaks the action.
 */
export function track (event) {
  const platform = event.platform || currentPlatform()
  const recorded = platform ? { ...event, platform } : event
  try {
    trackActivity(bookshelf.knex, recorded, { log })
  } catch (err) {
    log(err)
  }
}

/** Group ids a post was published into. */
export async function groupIdsForPost (postId) {
  const rows = await bookshelf.knex('groups_posts').where('post_id', postId).select('group_id')
  return rows.map(row => row.group_id)
}

/** Records a post someone created. Threads and system chat notices are skipped. */
export function trackPostCreated (post, groupIds) {
  const postType = post.get('type')
  if (!post.get('user_id') || postType === 'thread' || postType === 'chat_activity') return
  track({
    type: EVENT_TYPES.POST_CREATED,
    userId: post.get('user_id'),
    groupIds: groupIds || [],
    object: { type: 'post', id: post.id },
    postId: post.id,
    postType,
    properties: { isPublic: !!post.get('is_public') },
    occurredAt: post.get('created_at') || new Date()
  })
}

/** Records a comment, or a direct message when the post is a thread. */
export function trackComment (comment, post, groupIds) {
  const isThread = post.get('type') === 'thread'
  track({
    type: isThread ? EVENT_TYPES.MESSAGE_SENT : EVENT_TYPES.COMMENT_CREATED,
    userId: comment.get('user_id'),
    groupIds: isThread ? [] : groupIds,
    object: { type: 'comment', id: comment.id },
    targetUserId: post.get('user_id'),
    postId: post.id,
    postType: post.get('type'),
    properties: { commentId: comment.id },
    occurredAt: comment.get('created_at') || new Date()
  })
}

/** Records a reaction. `reaction` is the reactions row that was just saved. */
export function trackReaction ({ userId, reaction, post, groupIds, targetUserId, commentId = null }) {
  const isThread = post && post.get('type') === 'thread'
  track({
    type: EVENT_TYPES.REACTION_ADDED,
    userId,
    groupIds: isThread ? [] : groupIds,
    object: { type: 'reaction', id: reaction.id },
    targetUserId,
    postId: post ? post.id : null,
    postType: post ? post.get('type') : null,
    properties: commentId ? { commentId } : null,
    occurredAt: reaction.date_reacted || new Date()
  })
}
