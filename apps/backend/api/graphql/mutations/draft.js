/* global Draft Tag */
import { GraphQLError } from 'graphql'

/**
 * The `drafts.data` column is jsonb, so values must be valid JSON text. Post drafts are
 * JSON objects as strings; comment and message drafts are HTML and must be wrapped as a
 * JSON string (e.g. `"<p>…</p>"`) so PostgreSQL accepts them.
 */
function stripHtmlLite (html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Refuses empty drafts so metadata-only payloads are not persisted */
function draftPayloadHasWritableContent (type, data) {
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  if (type === 'post') {
    try {
      const obj = JSON.parse(str)
      if (!obj || typeof obj !== 'object') return false
      return stripHtmlLite(obj.details ?? '').length > 0 || String(obj.title ?? '').trim().length > 0
    } catch {
      return false
    }
  }
  if (type === 'comment') {
    return stripHtmlLite(str).length > 0
  }
  if (type === 'message') {
    try {
      const obj = JSON.parse(str)
      if (obj && typeof obj === 'object' && Object.prototype.hasOwnProperty.call(obj, 'text')) {
        return String(obj.text ?? '').trim().length > 0
      }
    } catch {
      // opaque body string
    }
    return stripHtmlLite(str).length > 0
  }
  return false
}

function serialiseDraftDataForDb (type, data) {
  if (data == null) throw new GraphQLError('data is required')
  const str = typeof data === 'string' ? data : JSON.stringify(data)
  if (type === 'comment' || type === 'message') {
    return JSON.stringify(str)
  }
  try {
    JSON.parse(str)
  } catch {
    throw new GraphQLError('Post draft data must be valid JSON')
  }
  return str
}

/**
 * Upserts a draft for the current user based on the provided context.
 * Uses INSERT ... ON CONFLICT DO UPDATE via raw knex since Bookshelf
 * doesn't support upsert with partial unique indexes natively.
 */
export async function saveDraft (userId, { type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }) {
  if (!type || !data) throw new GraphQLError('type and data are required')
  if (!['post', 'comment', 'message'].includes(type)) {
    throw new GraphQLError('type must be one of: post, comment, message')
  }
  if (!draftPayloadHasWritableContent(type, data)) {
    throw new GraphQLError('Draft must include a title or body content')
  }

  const parsedData = serialiseDraftDataForDb(type, data)

  const existing = await Draft.findForContext(userId, { type, postId, groupId, topicId, messageThreadId, postType, isEdit })

  if (existing) {
    await existing.save({
      data: parsedData,
      post_type: type === 'post' && !isEdit ? (postType || null) : null,
      navigate_to: navigateTo || existing.get('navigate_to'),
      updated_at: new Date()
    })
    return Draft.where({ id: existing.id }).fetch()
  }

  const attrs = {
    user_id: userId,
    type,
    data: parsedData,
    is_edit: !!isEdit,
    navigate_to: navigateTo || null,
    created_at: new Date(),
    updated_at: new Date()
  }

  if (postId) attrs.post_id = postId
  if (groupId) attrs.group_id = groupId
  if (topicId) attrs.topic_id = topicId
  if (messageThreadId) attrs.message_thread_id = messageThreadId
  if (type === 'post' && !isEdit) attrs.post_type = postType || null

  return Draft.forge(attrs).save()
}

/** Deletes a draft after verifying ownership. Returns success silently when already gone. */
export async function deleteDraft (userId, id) {
  const draft = await Draft.where({ id }).fetch({ require: false })
  if (!draft) return { success: true }
  if (String(draft.get('user_id')) !== String(userId)) {
    throw new GraphQLError("You don't have permission to delete this draft")
  }
  await draft.destroy()
  return { success: true }
}

/** Deletes the draft matching an exact compose context, if present. */
export async function deleteDraftForContext (userId, { type, postId, groupId, topicId, messageThreadId, postType, isEdit = false }) {
  const draft = await Draft.findForContext(userId, { type, postId, groupId, topicId, messageThreadId, postType, isEdit })
  if (!draft) return { success: true }
  await draft.destroy()
  return { success: true }
}

/** Best-effort cleanup for new post drafts after a post is created. */
export async function deletePostDraftForCreate (userId, { groupId, topicName, postType }) {
  let topicId = null
  if (topicName) {
    const topic = await Tag.where({ name: topicName }).fetch({ require: false })
    topicId = topic?.get('id') || null
  }
  return deleteDraftForContext(userId, {
    type: 'post',
    groupId,
    topicId,
    postType,
    isEdit: false
  })
}
