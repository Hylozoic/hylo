/* global Draft Tag */
import { GraphQLError } from 'graphql'

/**
 * The `drafts.data` column is jsonb, so values must be valid JSON text. Post drafts are
 * JSON objects as strings; comment and message drafts are HTML and must be wrapped as a
 * JSON string (e.g. `"<p>…</p>"`) so PostgreSQL accepts them.
 */
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
export async function saveDraft (userId, { type, data, postId, groupId, topicId, messageThreadId, isEdit, navigateTo }) {
  if (!type || !data) throw new GraphQLError('type and data are required')
  if (!['post', 'comment', 'message'].includes(type)) {
    throw new GraphQLError('type must be one of: post, comment, message')
  }

  const parsedData = serialiseDraftDataForDb(type, data)

  const existing = await Draft.findForContext(userId, { type, postId, groupId, topicId, messageThreadId, isEdit })

  if (existing) {
    await existing.save({
      data: parsedData,
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

  return Draft.forge(attrs).save()
}

/** Deletes a draft after verifying ownership. */
export async function deleteDraft (userId, id) {
  const draft = await Draft.where({ id }).fetch({ require: false })
  if (!draft) throw new GraphQLError('Draft not found')
  if (String(draft.get('user_id')) !== String(userId)) {
    throw new GraphQLError("You don't have permission to delete this draft")
  }
  await draft.destroy()
  return { success: true }
}

/** Deletes the draft matching an exact compose context, if present. */
export async function deleteDraftForContext (userId, { type, postId, groupId, topicId, messageThreadId, isEdit = false }) {
  const draft = await Draft.findForContext(userId, { type, postId, groupId, topicId, messageThreadId, isEdit })
  if (!draft) return { success: true }
  await draft.destroy()
  return { success: true }
}

/** Best-effort cleanup for new post drafts after a post is created. */
export async function deletePostDraftForCreate (userId, { groupId, topicName }) {
  let topicId = null
  if (topicName) {
    const topic = await Tag.where({ name: topicName }).fetch({ require: false })
    topicId = topic?.get('id') || null
  }
  return deleteDraftForContext(userId, {
    type: 'post',
    groupId,
    topicId,
    isEdit: false
  })
}
