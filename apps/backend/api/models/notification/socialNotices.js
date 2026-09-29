/* global Activity, BlockedUser */
// Social feedback notices to the person who made something (D7): reactions (D15),
// RSVPs to an event (D45) and votes on a proposal (D46). Each goes through
// notification/grouping, so the reader gets one notice per item with a running count.
// Channels come from signalClasses: reactions and RSVPs are in-app plus a grouped push,
// votes are in-app only, and none of them email.
//
// Creating a notice never fails the action that caused it; errors are reported. Callers
// don't wait for it either (inBackground), so a reaction, RSVP or vote responds at once.
import sentry from '../../../lib/sentry'
import { REACTION_NOTICES, isInVariant } from '../../../lib/experiments'
import { groupKeyFor } from './grouping'

// Reactions to chat messages and direct messages never notify (D15).
export const NO_REACTION_NOTICE_POST_TYPES = ['chat', 'chat_activity', 'thread']

const sameId = (a, b) => a !== null && a !== undefined && String(a) === String(b)

async function blockedBetween (readerId, actorId) {
  const blocked = await BlockedUser.blockedFor(readerId)
  return (blocked?.rows || []).some(row => sameId(row.user_id, actorId))
}

async function saveNotice ({ readerId, actorId, postId, commentId, reason, meta }) {
  if (!readerId || !actorId || sameId(readerId, actorId)) return null
  if (await blockedBetween(readerId, actorId)) return null
  const [activity] = await Activity.saveForReasons([{
    reader_id: readerId,
    actor_id: actorId,
    post_id: postId,
    ...(commentId ? { comment_id: commentId } : {}),
    reason,
    group_key: groupKeyFor(reason, { postId, commentId }),
    ...(meta ? { meta } : {})
  }])
  return activity || null
}

// Notices still being saved, so tests can wait for them (noticesSettled)
const pending = new Set()

export function inBackground (promise) {
  const settled = Promise.resolve(promise)
    .catch(err => sentry.error(err))
    .finally(() => pending.delete(settled))
  pending.add(settled)
}

export const noticesSettled = () => Promise.all([...pending])

const reported = fn => async (...args) => {
  try {
    return await fn(...args)
  } catch (err) {
    sentry.error(err)
    return null
  }
}

/*
 * D15, run as the REACTION_NOTICES experiment. Every author who would get a notice is
 * assigned when someone first reacts to their post or comment; only the 'notices' arm
 * is told. Whether authors post again is measured from experiment_assignments
 * (subject_id, variant, assigned_at) joined to their posts created after assigned_at.
 *
 * `comment` is set for a reaction to a comment; `post` is the post it belongs to.
 */
export const notifyReaction = reported(async ({ post, comment, userId }) => {
  if (!post && comment) post = await comment.post().fetch()
  if (!post) return null
  if (NO_REACTION_NOTICE_POST_TYPES.includes(post.get('type'))) return null
  const authorId = (comment || post).get('user_id')
  if (!authorId || sameId(authorId, userId)) return null
  if (!(await isInVariant(REACTION_NOTICES, authorId, 'notices'))) return null
  return saveNotice({
    readerId: authorId,
    actorId: userId,
    postId: post.id,
    commentId: comment?.id,
    reason: 'reaction'
  })
})

// D45: someone said they're going to, or interested in, someone else's event. One
// grouped notice per event for the host, in-app plus a grouped push, no email.
export const notifyRsvp = reported(async ({ event, userId, response }) => {
  if (!event || event.get('type') !== 'event') return null
  return saveNotice({
    readerId: event.get('user_id'),
    actorId: userId,
    postId: event.id,
    reason: 'eventRsvp',
    meta: { response }
  })
})

// D46: votes on someone's proposal, grouped per proposal, in-app only. Anonymous votes
// stay anonymous: the author is not told who voted.
export const notifyProposalVote = reported(async ({ post, userId }) => {
  if (!post || post.get('type') !== 'proposal') return null
  if (post.get('anonymous_voting') === 'true') return null
  return saveNotice({
    readerId: post.get('user_id'),
    actorId: userId,
    postId: post.id,
    reason: 'proposalVote'
  })
})
