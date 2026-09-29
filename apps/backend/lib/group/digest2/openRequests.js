/* global bookshelf, Post */
// D58: the digest's "Open requests" section brings back requests nobody has answered:
// unmet requests in the group and its spaces, with no comments, posted before this
// digest's window (newer ones are already in "New Requests") and within the last
// OPEN_REQUEST_MAX_AGE_DAYS.
//
// A deliberate exception to D39: dedupe.js never filters this section, so a request
// can appear again even if the member has already seen it. The author sees their own
// request here with one-tap "Still needed" and "It's been met" links.
import { relatedUserColumns, scopeGroupIds, wherePostedInGroups } from './util'

export const OPEN_REQUEST_MAX_AGE_DAYS = 30
export const OPEN_REQUESTS_PER_DIGEST = 3
// Fetched per group; each recipient keeps OPEN_REQUESTS_PER_DIGEST after their own filters
const OPEN_REQUESTS_FETCHED = 10

const DAY = 24 * 60 * 60 * 1000

const toDate = value => {
  if (!value) return new Date()
  if (typeof value.toJSDate === 'function') return value.toJSDate()
  return new Date(value)
}

/**
 * Open requests for one group's digest, newest first.
 * @param {Group} group
 * @param {Group[]} spaces the group's active spaces
 * @param {DateTime|Date} windowStart start of this digest's time range
 * @returns {Promise<Post[]>}
 */
export async function openRequestsForDigest (group, spaces, windowStart) {
  const before = toDate(windowStart)
  const since = new Date(before.getTime() - OPEN_REQUEST_MAX_AGE_DAYS * DAY)
  const groupIds = scopeGroupIds(group, spaces)

  const posts = await Post.query(q => {
    wherePostedInGroups(q, groupIds)
    q.where('posts.type', Post.Type.REQUEST)
    q.where('posts.active', true)
    q.whereNull('posts.fulfilled_at')
    q.where(q2 => q2.whereNull('posts.end_time').orWhere('posts.end_time', '>', new Date()))
    q.where('posts.created_at', '<', before)
    q.where('posts.created_at', '>=', since)
    q.whereNotExists(function () {
      this.select(bookshelf.knex.raw('1'))
        .from('comments')
        .whereRaw('comments.post_id = posts.id')
        .where('comments.active', true)
    })
    q.orderBy('posts.created_at', 'desc')
    q.limit(OPEN_REQUESTS_FETCHED)
  }).fetchAll({
    withRelated: ['tags', relatedUserColumns(), 'linkPreview', 'media', 'groups']
  })

  return posts.models
}
