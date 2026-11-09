export const RECENT_POST_IDS_LIMIT = 5
export const OPTIMISTIC_NOTICE_PREFIX = 'optimistic-chat-activity-'

/**
 * Returns the UTC hour start for a chat timestamp.
 * @param {Date|string} [date]
 * @returns {Date}
 */
export function chatActivityBucketStart (date = new Date()) {
  const d = new Date(date)
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), d.getUTCHours()))
}

/**
 * Idempotent bucket key for one group/space's chats in a given UTC hour.
 * @param {string|number} groupId
 * @param {Date|string} [date]
 * @returns {string}
 */
export function chatActivityBucketKey (groupId, date) {
  return `${groupId}:${chatActivityBucketStart(date).toISOString().slice(0, 13)}`
}

/**
 * Client-only id used until the server notice post exists.
 * @param {string|number} groupId
 * @param {Date|string} [date]
 * @returns {string}
 */
export function optimisticChatActivityNoticeId (groupId, date) {
  return `${OPTIMISTIC_NOTICE_PREFIX}${chatActivityBucketKey(groupId, date)}`
}

/**
 * @param {string|number} id
 * @returns {boolean}
 */
export function isOptimisticChatActivityNoticeId (id) {
  return String(id).startsWith(OPTIMISTIC_NOTICE_PREFIX)
}

/**
 * Parses noticeData whether the API returned an object or a JSON string.
 * @param {*} value
 * @returns {object|null}
 */
export function parseNoticeData (value) {
  if (!value) return null
  if (typeof value === 'string') {
    try {
      return JSON.parse(value)
    } catch (e) {
      return null
    }
  }
  return value
}

/**
 * Updates or creates the hour-bucket notice in ORM for a just-sent chat.
 * @param {object} session
 * @param {{ groupId: string|number, chat: object }} opts
 * @returns {object|null}
 */
export function upsertOptimisticChatActivityNotice (session, { groupId, chat }) {
  const { Group } = session
  if (!groupId || !Group.idExists(groupId)) return null

  const when = chat.createdAt || new Date().toISOString()
  const bucketKey = chatActivityBucketKey(groupId, when)
  const notice = findNoticeByBucketKey(session, bucketKey) || createOptimisticNotice(session, { groupId, bucketKey, when })
  applyChatPreview(notice, toPreview(chat, when), { increment: true })
  return notice
}

/**
 * Replaces a pending localId in the notice with the saved chat id.
 * @param {object} session
 * @param {{ groupId: string|number, localId?: string, chat: object }} opts
 * @returns {object|null}
 */
export function confirmOptimisticChatInNotice (session, { groupId, localId, chat }) {
  if (!groupId) return null
  const when = chat.createdAt || new Date().toISOString()
  const notice = findNoticeByBucketKey(session, chatActivityBucketKey(groupId, when))
  if (!notice) {
    return upsertOptimisticChatActivityNotice(session, { groupId, chat })
  }
  applyChatPreview(notice, toPreview(chat, when), { replaceId: localId, increment: false })
  return notice
}

/**
 * Drops the temporary notice once the real server post is in ORM.
 * @param {object} session
 * @param {object} realNotice
 */
export function replaceOptimisticChatActivityNotice (session, realNotice) {
  const data = parseNoticeData(realNotice.noticeData)
  const bucketKey = data?.bucketKey
  if (!bucketKey) return
  const optimisticId = `${OPTIMISTIC_NOTICE_PREFIX}${bucketKey}`
  if (String(realNotice.id) === optimisticId) return
  if (session.Post.idExists(optimisticId)) {
    session.Post.withId(optimisticId).delete()
  }
}

/**
 * After FETCH_POSTS, keep a locally newer hour card instead of stale server data.
 * @param {object} session
 * @param {object[]} preserved
 */
export function reconcileChatActivityNoticesAfterFetch (session, preserved) {
  if (!preserved?.length) return
  const { Post } = session

  preserved.forEach(prev => {
    const prevData = parseNoticeData(prev.noticeData)
    const bucketKey = prevData?.bucketKey
    if (!bucketKey) return

    const incoming = Post.all().toModelArray().find(p => {
      if (p.type !== 'chat_activity') return false
      return parseNoticeData(p.noticeData)?.bucketKey === bucketKey
    })

    if (incoming && isOptimisticChatActivityNoticeId(prev.id) && String(incoming.id) !== String(prev.id)) {
      if (isLocallyNewer(prev, incoming)) {
        incoming.update({
          createdAt: prev.createdAt,
          noticeData: prev.noticeData,
          noticePosts: prev.noticePosts
        })
      }
      if (Post.idExists(prev.id)) Post.withId(prev.id).delete()
      return
    }

    if (!incoming && isOptimisticChatActivityNoticeId(prev.id) && !Post.idExists(prev.id)) {
      return
    }

    if (incoming && isLocallyNewer(prev, incoming)) {
      incoming.update({
        createdAt: prev.createdAt,
        noticeData: prev.noticeData,
        noticePosts: prev.noticePosts
      })
    }
  })
}

/**
 * Snapshots chat_activity posts so a later fetch cannot clobber a newer local card.
 * @param {object} Post
 * @returns {object[]}
 */
export function snapshotChatActivityNotices (Post) {
  return Post.all().toModelArray()
    .filter(p => p.type === 'chat_activity')
    .map(p => ({
      id: p.id,
      createdAt: p.createdAt,
      noticeData: p.noticeData,
      noticePosts: p.noticePosts
    }))
}

/**
 * Puts the current UTC-hour notice(s) for this All Activity view at the front.
 * @param {object} session
 * @param {object[]} posts
 * @param {{ filter?: string, slug?: string, groupId?: string }} props
 * @returns {object[]}
 */
export function prependCurrentHourNotices (session, posts, { filter, slug, groupId } = {}) {
  if (filter !== 'all+notices' || !slug) return posts

  const hourSuffix = `:${chatActivityBucketStart().toISOString().slice(0, 13)}`
  const hourNotices = session.Post.all().toModelArray().filter(p => {
    if (p.type !== 'chat_activity') return false
    const data = parseNoticeData(p.noticeData)
    if (!data?.bucketKey || !String(data.bucketKey).endsWith(hourSuffix)) return false
    return noticeBelongsToView(p, slug, groupId)
  })

  const byKey = new Map()
  hourNotices.forEach(p => {
    const key = parseNoticeData(p.noticeData).bucketKey
    const existing = byKey.get(key)
    if (!existing || isOptimisticChatActivityNoticeId(existing.id)) {
      byKey.set(key, p)
    }
  })

  const toPrepend = [...byKey.values()].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
  const prependIds = new Set(toPrepend.map(p => String(p.id)))
  const rest = posts.filter(p => {
    const id = String(p.id)
    if (prependIds.has(id)) return false
    if (isOptimisticChatActivityNoticeId(id) && toPrepend.some(n => parseNoticeData(n.noticeData)?.bucketKey === parseNoticeData(p.noticeData)?.bucketKey)) {
      return false
    }
    return true
  })
  return toPrepend.concat(rest)
}

/**
 * Whether a notice post belongs to this group/space All Activity stream.
 * Spaces match the parent via parentId (a column on groups, no extra fetch).
 * @param {object} post
 * @param {string} slug
 * @param {string} [groupId]
 * @returns {boolean}
 */
export function noticeBelongsToView (post, slug, groupId) {
  const groups = post.groups?.toModelArray?.() || []
  return groups.some(g => {
    if (g.slug === slug) return true
    return Boolean(groupId && g.parentId && String(g.parentId) === String(groupId))
  })
}

function findNoticeByBucketKey (session, bucketKey) {
  return session.Post.all().toModelArray().find(p => {
    if (p.type !== 'chat_activity') return false
    return parseNoticeData(p.noticeData)?.bucketKey === bucketKey
  }) || null
}

function createOptimisticNotice (session, { groupId, bucketKey, when }) {
  const id = `${OPTIMISTIC_NOTICE_PREFIX}${bucketKey}`
  const createdAt = typeof when === 'string' ? when : new Date(when).toISOString()
  session.Post.create({
    id,
    type: 'chat_activity',
    createdAt,
    updatedAt: createdAt,
    noticeData: {
      bucketKey,
      groupId: Number(groupId) || groupId,
      bucketStart: chatActivityBucketStart(when).toISOString(),
      recentPostIds: [],
      postCount: 0
    },
    noticePosts: [],
    groups: [groupId]
  })
  return session.Post.withId(id)
}

function applyChatPreview (notice, preview, { replaceId, increment = true } = {}) {
  const data = parseNoticeData(notice.noticeData) || {}
  const dropIds = new Set([String(preview.id), replaceId && String(replaceId)].filter(Boolean))
  const prevPosts = (notice.noticePosts || []).filter(p => !dropIds.has(String(p.id)))
  const noticePosts = [preview, ...prevPosts].slice(0, RECENT_POST_IDS_LIMIT)
  const prevIds = (data.recentPostIds || []).filter(id => !dropIds.has(String(id)))
  const recentPostIds = [preview.id, ...prevIds].slice(0, RECENT_POST_IDS_LIMIT)
  const alreadyHad = (data.recentPostIds || []).some(id => dropIds.has(String(id))) ||
    (notice.noticePosts || []).some(p => dropIds.has(String(p.id)))
  const postCount = alreadyHad || !increment
    ? Math.max(data.postCount || 0, noticePosts.length)
    : (data.postCount || 0) + 1

  notice.update({
    createdAt: preview.createdAt,
    updatedAt: preview.createdAt,
    noticeData: {
      ...data,
      recentPostIds,
      postCount
    },
    noticePosts
  })
}

function toPreview (chat, when) {
  const createdAt = typeof when === 'string' ? when : new Date(when).toISOString()
  const creator = chat.creator
  return {
    id: chat.id || chat.localId,
    details: chat.details || '',
    createdAt,
    creator: creator
      ? {
          id: creator.id,
          name: creator.name,
          avatarUrl: creator.avatarUrl
        }
      : null
  }
}

function isLocallyNewer (prev, incoming) {
  const prevCount = parseNoticeData(prev.noticeData)?.postCount || prev.noticePosts?.length || 0
  const nextCount = parseNoticeData(incoming.noticeData)?.postCount || incoming.noticePosts?.length || 0
  if (prevCount !== nextCount) return prevCount > nextCount
  return new Date(prev.createdAt) > new Date(incoming.createdAt)
}
