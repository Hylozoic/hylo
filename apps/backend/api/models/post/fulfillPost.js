/* global Activity, Contribution, bookshelf */
import { groupKeyFor, removeActivities, removeNoticesWithKey } from '../notification/grouping'

// Marks the post fulfilled (keeping the first date if it already was) and adds a
// Contribution for each helper not already credited; Contribution.createActivities
// tells each new helper (D27).
export function fulfill (opts = {}) {
  const { fulfilledAt, contributorIds } = opts
  return bookshelf.transaction(async transacting => {
    await this.save(
      { fulfilled_at: (fulfilledAt || this.get('fulfilled_at') || new Date()) },
      { patch: true, transacting }
    )
    const existing = (await bookshelf.knex('contributions')
      .where('post_id', this.id)
      .pluck('user_id')
      .transacting(transacting)).map(String)
    const newHelperIds = [...new Set((contributorIds || []).map(String))]
      .filter(userId => !existing.includes(userId))
    await Promise.all(newHelperIds.map(userId => Contribution.create(userId, this.id, transacting)))
    return this
  })
}

export function unfulfill () {
  return bookshelf.transaction(transacting => {
    const unfulfill = (post) =>
      post.save({ fulfilled_at: null }, { patch: true, transacting })
    const loadContributions = (post) =>
      post.load(['contributions'], { transacting })
    const removeHelperActivities = (post) =>
      Promise.map(
        post.relations.contributions.models,
        c => Activity.removeForContribution(c.id, transacting)
      )
    const removeContributions = (post) =>
      Promise.map(
        post.relations.contributions.models,
        c => c.destroy({ transacting, require: false })
      )
    // A reopened request is no longer met: take back the notices that said so
    const removeRequestMet = (post) =>
      removeNoticesWithKey(groupKeyFor('requestMet', { postId: post.id }), transacting)
    return unfulfill(this).then(loadContributions)
      .tap(removeHelperActivities)
      .tap(removeContributions)
      .tap(removeRequestMet)
  })
}

// D27: followers hear, in-app only, that a request they follow was met. Not the
// author, not whoever marked it met, and not helpers (they get their own notice).
// Followers who unfollowed or muted the post are left out.
export async function notifyRequestMet ({ post, actorId, helperIds = [] }) {
  if (!post || post.get('type') !== 'request') return 0
  const skip = new Set([post.get('user_id'), actorId, ...helperIds].filter(Boolean).map(String))
  const followerIds = (await bookshelf.knex('posts_users')
    .join('users', 'users.id', 'posts_users.user_id')
    .where({ 'posts_users.post_id': post.id, 'posts_users.following': true, 'posts_users.active': true, 'users.active': true })
    .whereNull('posts_users.muted_at')
    .pluck('posts_users.user_id'))
    .map(String)
    .filter(id => !skip.has(id))
  if (followerIds.length === 0) return 0
  const groupKey = groupKeyFor('requestMet', { postId: post.id })
  await Activity.saveForReasons(followerIds.map(readerId => ({
    reader_id: readerId,
    actor_id: actorId,
    post_id: post.id,
    reason: 'requestMet',
    group_key: groupKey
  })))
  return followerIds.length
}

// Helpers named after the request was marked met already got 'request met' as
// followers; their helper notice replaces it.
export async function removeRequestMetFor ({ post, userIds = [] }) {
  if (!post || userIds.length === 0) return
  const ids = await bookshelf.knex('activities')
    .where('group_key', groupKeyFor('requestMet', { postId: post.id }))
    .whereIn('reader_id', userIds)
    .pluck('id')
  return removeActivities(ids)
}
