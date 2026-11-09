import { refineOne } from '../util/relations'
import { groupRoom, pushToSockets } from '../../services/Websockets'

export const RECENT_POST_IDS_LIMIT = 5

/**
 * Returns the UTC hour start for a chat timestamp.
 * @param {Date|string} date
 * @returns {Date}
 */
export function chatActivityBucketStart (date) {
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()))
}

/**
 * Idempotent bucket key for one group/space's chats in a given UTC hour.
 * @param {string|number} groupId
 * @param {Date|string} date
 * @returns {string}
 */
export function chatActivityBucketKey (groupId, date) {
  return `${groupId}:${chatActivityBucketStart(date).toISOString().slice(0, 13)}`
}

/**
 * Rebuilds the chat_activity notice for every group a chat post belongs to.
 * Works for both create and delete: live chats in the hour are re-queried.
 * @param {{ postId: string|number }} opts
 */
export default async function upsertChatActivityNotice ({ postId }) {
  const post = await Post.query(q => q.where('posts.id', postId))
    .fetch({ withRelated: ['groups'], require: false })
  if (!post || post.get('type') !== Post.Type.CHAT) return

  const groups = post.relations.groups
  if (!groups || groups.length === 0) return

  return Promise.map(groups.models, group => upsertForGroup(post, group.id))
}

/**
 * Finds the active hour-bucket notice for a chat post's first group.
 * Used after create so the mutation can return the card to All Activity.
 * @param {object} post
 * @returns {Promise<object|null>}
 */
export async function findChatActivityNoticeForPost (post) {
  if (!post || post.get('type') !== Post.Type.CHAT) return null
  if (!post.relations.groups) {
    await post.load('groups')
  }
  const group = post.relations.groups.first()
  if (!group) return null
  const bucketKey = chatActivityBucketKey(group.id, post.get('created_at'))
  return Post.query(q => {
    q.whereRaw("posts.notice_data->>'bucketKey' = ?", [bucketKey])
    q.where('posts.active', true)
  }).fetch({ require: false })
}

/**
 * Upserts the hour bucket notice for one group/space.
 * @param {object} chatPost
 * @param {string|number} groupId
 */
async function upsertForGroup (chatPost, groupId) {
  const bucketStart = chatActivityBucketStart(chatPost.get('created_at'))
  const bucketEnd = new Date(bucketStart.getTime() + 60 * 60 * 1000)
  const bucketKey = chatActivityBucketKey(groupId, chatPost.get('created_at'))

  const chats = await Post.query(q => {
    q.join('groups_posts', 'groups_posts.post_id', 'posts.id')
    q.where('groups_posts.group_id', groupId)
    q.where('posts.type', Post.Type.CHAT)
    q.where('posts.active', true)
    q.where('posts.created_at', '>=', bucketStart)
    q.where('posts.created_at', '<', bucketEnd)
    q.orderBy('posts.created_at', 'desc')
    q.orderBy('posts.id', 'desc')
  }).fetchAll()

  const existing = await Post.query(q => {
    q.whereRaw("posts.notice_data->>'bucketKey' = ?", [bucketKey])
  }).fetch({ require: false })

  if (chats.length === 0) {
    if (existing) {
      await existing.save({ active: false, deactivated_at: new Date() }, { patch: true })
    }
    return existing
  }

  const chatModels = chats.models
  const newest = chatModels[0]
  const newestAt = newest.get('created_at')
  const noticeData = {
    bucketKey,
    groupId: Number(groupId),
    bucketStart: bucketStart.toISOString(),
    recentPostIds: chatModels.slice(0, RECENT_POST_IDS_LIMIT).map(p => Number(p.id)),
    postCount: chats.length
  }

  return bookshelf.transaction(async transacting => {
    try {
      const notice = await saveNotice({ existing, noticeData, newestAt, groupId, transacting })
      return notice
    } catch (err) {
      if (!isUniqueViolation(err)) throw err
      const raced = await Post.query(q => {
        q.whereRaw("posts.notice_data->>'bucketKey' = ?", [bucketKey])
      }).fetch({ transacting, require: false })
      return saveNotice({ existing: raced, noticeData, newestAt, groupId, transacting })
    }
  }).then(notice => {
    if (notice && notice.get('active') !== false) {
      return publishChatActivityNotice(notice).then(() => notice)
    }
    return notice
  })
}

/**
 * Inserts or updates a chat_activity post and stamps sort timestamps via knex
 * so Bookshelf hasTimestamps cannot overwrite them.
 */
async function saveNotice ({ existing, noticeData, newestAt, groupId, transacting }) {
  if (existing) {
    await existing.save({
      notice_data: noticeData,
      active: true,
      deactivated_at: null
    }, { patch: true, transacting })
    await stampTimestamps(existing.id, newestAt, transacting)
    return existing
  }

  const notice = await Post.create({
    type: Post.Type.CHAT_ACTIVITY,
    user_id: User.AXOLOTL_ID,
    notice_data: noticeData,
    active: true
  }, { transacting })
  await notice.groups().attach(groupId, { transacting })
  await stampTimestamps(notice.id, newestAt, transacting)
  return notice
}

/** Sets created_at and updated_at to the newest chat time. */
async function stampTimestamps (postId, newestAt, transacting) {
  let q = bookshelf.knex('posts').where({ id: postId }).update({
    created_at: newestAt,
    updated_at: newestAt
  })
  if (transacting) q = q.transacting(transacting)
  return q
}

/**
 * Pushes the notice into group (and parent) socket rooms so All Activity
 * can prepend or update the card without a full refresh.
 * @param {object} notice
 */
async function publishChatActivityNotice (notice) {
  const fresh = await Post.query(q => q.where('posts.id', notice.id))
    .fetch({ withRelated: ['groups', 'user'], require: false })
  if (!fresh || !fresh.get('active')) return

  const noticeData = fresh.get('notice_data') || {}
  const ids = noticeData.recentPostIds || []
  let noticePosts = []
  if (ids.length) {
    const chats = await Post.query(q => {
      q.whereIn('posts.id', ids)
      q.where('posts.active', true)
    }).fetchAll({ withRelated: ['user'] })
    const byId = new Map(chats.models.map(p => [String(p.id), p]))
    noticePosts = ids.map(id => byId.get(String(id))).filter(Boolean).map(p => ({
      id: p.id,
      details: p.details(),
      createdAt: p.get('created_at'),
      creator: refineOne(p.relations.user, ['id', 'name', 'avatar_url'])
    }))
  }

  const groups = (fresh.relations.groups?.models || []).map(g => ({
    id: g.id,
    name: g.get('name'),
    slug: g.get('slug'),
    type: g.get('type'),
    parentId: g.get('parent_id') || null
  }))

  const payload = Object.assign({}, fresh.getNewPostSocketPayload(), {
    noticeData,
    noticePosts,
    groups
  })

  const rooms = new Set()
  groups.forEach(g => {
    rooms.add(groupRoom(g.id))
    if (g.parentId) rooms.add(groupRoom(g.parentId))
  })

  return Promise.map(Array.from(rooms), room => pushToSockets(room, 'newPost', payload))
}

/** Returns true when a unique-index conflict occurred on the bucket key. */
function isUniqueViolation (err) {
  const code = err.code || err.nativeError?.code
  if (code === '23505') return true
  const message = err.message || ''
  return message.includes('posts_notice_bucket_key')
}
