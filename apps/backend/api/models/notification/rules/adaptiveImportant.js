/* global bookshelf */
// "Important" adapts to what is going on (D94):
//
// 1. Conversation window. After you send a chat message in a room (a group's or a
//    space's chat), new messages in that room reach you as important for
//    CONVERSATION_WINDOW_MINUTES: push and in-app, never email. The window runs from
//    your own latest message in that room, so every message you send restarts it and
//    other people's messages don't extend it. Post.createActivities marks the chat
//    activities of readers inside their window with meta.inConversation.
//
// 2. Quiet places. In a group or space marked quiet by group/activityBenchmark (fewer
//    feed posts in the last 28 days than the healthy-group line), every feed post
//    counts as important, on the reader's email and push switches. Only for readers
//    active in the last READER_ACTIVE_DAYS, so it never reaches lapsed members.
//
// Readers on "No Posts" are unaffected by both (they still get mentions).
import { find } from 'lodash'
import { isChat, isNewPost } from './predicates'

export const CONVERSATION_WINDOW_DEFAULT_MINUTES = 20
export const CONVERSATION_WINDOW_MIN_MINUTES = 5
export const CONVERSATION_WINDOW_MAX_MINUTES = 20

// NOTIFICATION_CONVERSATION_WINDOW_MINUTES tunes the window, kept within 5–20 minutes.
export function conversationWindowMinutes (env = process.env) {
  const raw = Number.parseInt(env.NOTIFICATION_CONVERSATION_WINDOW_MINUTES, 10)
  const minutes = Number.isFinite(raw) ? raw : CONVERSATION_WINDOW_DEFAULT_MINUTES
  return Math.min(CONVERSATION_WINDOW_MAX_MINUTES, Math.max(CONVERSATION_WINDOW_MIN_MINUTES, minutes))
}

export const CONVERSATION_WINDOW_MINUTES = conversationWindowMinutes()

export const READER_ACTIVE_DAYS = 30

// One query: the people (other than the author) whose own latest chat message in one
// of these rooms was sent within the window before this message. Returns
// [{ groupId, userId }] as strings. It runs on every chat message, so it starts from
// the partial index posts_chat_created_at_index (recent chats only); the type test is
// a literal so the planner can match that index's predicate.
export async function conversationParticipants ({ postId, authorId, groupIds, createdAt, trx, minutes = conversationWindowMinutes() }) {
  if (!groupIds || groupIds.length === 0) return []
  const at = createdAt ? new Date(createdAt) : new Date()
  const since = new Date(at.getTime() - minutes * 60000)
  const query = bookshelf.knex('posts')
    .join('groups_posts', 'groups_posts.post_id', 'posts.id')
    .distinct('groups_posts.group_id', 'posts.user_id')
    .whereIn('groups_posts.group_id', groupIds)
    .whereRaw("posts.type = 'chat'")
    .where('posts.active', true)
    .whereNot('posts.user_id', authorId)
    .whereNot('posts.id', postId)
    .where('posts.created_at', '>=', since)
    .where('posts.created_at', '<=', at)
  if (trx) query.transacting(trx)
  const rows = await query
  return rows.map(row => ({ groupId: String(row.group_id), userId: String(row.user_id) }))
}

// Gate pass: a chat in a room the reader is talking in reaches a reader on Important.
export const conversationPasses = ctx =>
  ctx.postSetting === 'important' &&
  isChat(ctx) &&
  ctx.activity.get('meta')?.inConversation === true

function readerActiveRecently (reader, now = new Date()) {
  const lastActiveAt = typeof reader?.get === 'function' ? reader.get('last_active_at') : null
  if (!lastActiveAt) return false
  return now - new Date(lastActiveAt) <= READER_ACTIVE_DAYS * 24 * 60 * 60 * 1000
}

function isQuietGroup (group) {
  const settings = typeof group?.get === 'function' ? group.get('settings') : null
  return settings?.below_activity_benchmark === true
}

// Gate pass: in a quiet group or space, a new feed post reaches a recently active
// reader on Important as if they were on Every post.
export const quietGroupPasses = ctx => {
  if (!isNewPost(ctx) || isChat(ctx)) return false
  const important = ctx.relevantMemberships.filter(mem =>
    mem.getSetting('postNotifications') === 'important')
  if (!find(important, mem => isQuietGroup(mem.related('group')))) return false
  return readerActiveRecently(ctx.reader)
}
