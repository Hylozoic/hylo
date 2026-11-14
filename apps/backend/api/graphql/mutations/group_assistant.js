/* global bookshelf, Group, GroupMembership, Responsibility, sails */
import { GraphQLError } from 'graphql'
import {
  MAX_ASSISTANT_MESSAGE_LENGTH,
  sanitizeAssistantParts,
  sanitizeGroupAssistantSettings,
  validateGroupAssistantSettings
} from '@hylo/shared'
import { assistantTurnInChildProcess, isGroupAssistantConfigured } from '../../../lib/groupAssistant'
import { assistantSpaceChoices, fetchAssistantContent, formatAssistantContent, linkablePostIds } from '../../../lib/groupAssistantContent'
import RedisClient from '../../services/RedisClient'

/**
 * The Group Assistant (Axl): a private thread between a group's stewards and
 * an AI assistant. See lib/groupAssistant.js for the model call and
 * lib/groupAssistantContent.js for what it may read.
 *
 * The rules that hold here, in code rather than in the model's instructions:
 * - Stewards only. Every function checks the caller holds the Administration
 *   responsibility in the group right now, on every read and write, so someone
 *   who stops being a steward loses the thread at once.
 * - Hylo Pro, per group, and only once a steward has turned the assistant on.
 * - Nothing the model returns changes anything: its answer is stored as a
 *   message. A draft becomes a post only when a steward posts it themselves,
 *   through the ordinary post and comment mutations, under their own name.
 */

export const HYLO_PRO_REQUIRED_FOR_ASSISTANT = 'The Group Assistant is part of Hylo Pro. This group needs Hylo Pro to use it.'
const TURNS_PER_GROUP_PER_HOUR = 60
const THREAD_PAGE = 100
const HISTORY_FOR_MODEL = 20

async function requireSteward (userId, groupId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')
  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Group not found')
  // The assistant belongs to a group; a space is one of the things it can read
  if (group.get('type') === 'space') throw new GraphQLError('The Group Assistant is set up on the group, not on a space')
  if (!(await GroupMembership.hasResponsibility(userId, group, Responsibility.constants.RESP_ADMINISTRATION))) {
    throw new GraphQLError('Only stewards of this group can use the Group Assistant')
  }
  return group
}

const requirePro = async group => {
  if (!(await group.hasPro())) throw new GraphQLError(HYLO_PRO_REQUIRED_FOR_ASSISTANT, { extensions: { code: 'HYLO_PRO_REQUIRED' } })
}

const storedSettings = group => sanitizeGroupAssistantSettings((group.get('settings') || {}).assistant)

async function withinTurnLimit (groupId) {
  try {
    const redis = RedisClient.create()
    const key = `ratelimit:groupAssistant:group:${groupId}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60 * 60)
    return count <= TURNS_PER_GROUP_PER_HOUR
  } catch (err) {
    sails.log.error(`groupAssistant withinTurnLimit failed: ${err.message}`)
    return true
  }
}

const presentMessage = row => ({
  id: String(row.id),
  authorType: row.author_type,
  author: row.user_id ? { id: String(row.user_id), name: row.author_name || '', avatarUrl: row.author_avatar_url || null } : null,
  text: row.text,
  parts: Array.isArray(row.parts) ? row.parts : [],
  createdAt: new Date(row.created_at).toISOString()
})

const messagesQuery = () => bookshelf.knex('group_assistant_messages')
  .leftJoin('users', 'users.id', 'group_assistant_messages.user_id')
  .select('group_assistant_messages.*', 'users.name as author_name', 'users.avatar_url as author_avatar_url')

const threadQuery = groupId => messagesQuery().where('group_assistant_messages.group_id', groupId)

/** Every piece of text in a message that Axl wrote, where it may have named a post as "#123". */
const messageTexts = message => [
  message.text,
  ...(message.parts || []).flatMap(part => part.type === 'bullets'
    ? part.items
    : part.type === 'counsel' ? part.steps.flatMap(step => [step.title, step.line]) : [])
]

/**
 * Adds postRefs to Axl's messages: the post ids it named in its text that are
 * real posts in the spaces it may read now. The screen links those and no others.
 */
async function withPostRefs (group, messages) {
  const fromAxl = messages.filter(message => message.authorType === 'axl')
  if (fromAxl.length === 0) return messages
  const linkable = await linkablePostIds({
    groupId: group.id,
    readableGroupIds: storedSettings(group).readableGroupIds,
    texts: fromAxl.flatMap(messageTexts)
  })
  return messages.map(message => {
    if (message.authorType !== 'axl') return message
    const named = new Set(messageTexts(message).flatMap(text => [...String(text || '').matchAll(/#([1-9][0-9]{0,18})\b/g)].map(match => match[1])))
    return { ...message, postRefs: [...named].filter(id => linkable.has(id)) }
  })
}

/** The newest messages of a group's thread, oldest first. */
async function fetchThread (groupId, limit = THREAD_PAGE) {
  const rows = await threadQuery(groupId).orderBy('group_assistant_messages.id', 'desc').limit(limit)
  return rows.reverse().map(presentMessage)
}

async function fetchMessage (id) {
  if (!/^[1-9][0-9]{0,18}$/.test(String(id))) return null
  return (await messagesQuery().where('group_assistant_messages.id', id).first()) || null
}

async function stewardNames (group) {
  const stewards = await group.membersWithResponsibilities([Responsibility.constants.RESP_ADMINISTRATION]).fetch()
  return stewards.map(user => ({ id: String(user.id), name: user.get('name') || '' }))
}

/** Everything the assistant screen and its settings card need, for a steward. */
async function presentAssistant (group, { withThread = true } = {}) {
  const hasPro = await group.hasPro()
  const settings = storedSettings(group)
  const spaces = await assistantSpaceChoices(group.id)
  // A space that was deleted or archived out of the group stops counting at once
  const choiceIds = new Set(spaces.map(space => space.id))
  settings.readableGroupIds = settings.readableGroupIds.filter(id => choiceIds.has(id))
  return {
    hasPro,
    configured: isGroupAssistantConfigured(),
    settings,
    spaces,
    stewards: await stewardNames(group),
    messages: withThread && hasPro && settings.enabled ? await withPostRefs(group, await fetchThread(group.id)) : []
  }
}

/**
 * The assistant's settings, the spaces it could read, the stewards who share
 * the thread, and the thread itself. Stewards only. Works without Hylo Pro
 * (the settings card shows as locked), but returns no messages then.
 */
export async function groupAssistant ({ userId, groupId }) {
  const group = await requireSteward(userId, groupId)
  return presentAssistant(group)
}

/**
 * Saves the assistant's settings. Turning it on, or leaving it on, needs Hylo
 * Pro; turning it off never does. The readable spaces must be the group itself
 * or its own child spaces. Takes effect at once: the next request reads the
 * new list.
 */
export async function updateGroupAssistantSettings ({ userId, groupId, settings }) {
  const group = await requireSteward(userId, groupId)
  const { settings: clean, errors } = validateGroupAssistantSettings({ ...storedSettings(group), ...(settings || {}) })
  if (errors.length > 0) throw new GraphQLError(`Invalid assistant settings: ${errors.join('; ')}`)
  if (clean.enabled) await requirePro(group)

  const choiceIds = new Set((await assistantSpaceChoices(group.id)).map(space => space.id))
  const outside = clean.readableGroupIds.filter(id => !choiceIds.has(id))
  if (outside.length > 0) throw new GraphQLError('The assistant can only read this group and its own spaces')

  // Update only the assistant key in one statement, so a concurrent change to another setting is not overwritten
  await bookshelf.knex('groups').where('id', group.id).update({
    settings: bookshelf.knex.raw("jsonb_set(COALESCE(settings, '{}'::jsonb), '{assistant}', ?::jsonb)", [JSON.stringify({ ...clean, updatedBy: String(userId), updatedAt: new Date().toISOString() })]),
    updated_at: new Date()
  })
  return presentAssistant(await group.refresh())
}

/**
 * Adds to each part what the screen needs to show it without another request:
 * a snapshot of a quoted post, and where a draft would be posted.
 */
function describeParts (parts, content) {
  return parts.map(part => {
    if (part.type === 'quotedPost') {
      const post = content.posts.find(item => item.id === part.postId)
      return { ...part, author: post.author, space: post.space, spaceId: post.spaceId, createdAt: post.createdAt, replies: post.replies, title: post.title, text: post.text }
    }
    if (part.type === 'draft') {
      if (part.replyToPostId) {
        const post = content.posts.find(item => item.id === part.replyToPostId)
        return { ...part, space: post.space, replyToTitle: post.title || post.text.slice(0, 80) }
      }
      return { ...part, space: content.spaces.find(space => space.id === part.groupId)?.name || '' }
    }
    return part
  })
}

/**
 * A steward writes in the thread and the assistant answers. Both messages are
 * stored and returned, with the token usage and estimated cost of the answer.
 * The steward's message is kept even if the assistant fails to answer.
 */
export async function askGroupAssistant ({ userId, groupId, text }, deps = {}) {
  const group = await requireSteward(userId, groupId)
  await requirePro(group)
  const settings = storedSettings(group)
  if (!settings.enabled) throw new GraphQLError('The Group Assistant is turned off for this group. A steward can turn it on in Group Settings.')
  if (!(deps.isConfigured || isGroupAssistantConfigured)()) throw new GraphQLError('The Group Assistant is not set up on this server')

  const message = typeof text === 'string' ? text.trim() : ''
  if (!message) throw new GraphQLError('Write a message first')
  if (message.length > MAX_ASSISTANT_MESSAGE_LENGTH) throw new GraphQLError(`A message can be up to ${MAX_ASSISTANT_MESSAGE_LENGTH} characters`)
  if (!(await (deps.withinLimit || withinTurnLimit)(group.id))) {
    throw new GraphQLError('This group has asked the assistant a lot in the last hour. Please try again later.')
  }

  const knex = bookshelf.knex
  const earlier = await fetchThread(group.id, HISTORY_FOR_MODEL)
  const [stewardRow] = await knex('group_assistant_messages')
    .insert({ group_id: group.id, author_type: 'steward', user_id: userId, text: message })
    .returning('id')
  const stewardMessageId = stewardRow.id || stewardRow

  // The only content the model sees: what the stewards chose, selected in the database
  const content = await (deps.fetchContent || fetchAssistantContent)({ group, readableGroupIds: settings.readableGroupIds })
  const allowedPostIds = content.posts.map(post => post.id)
  const allowedGroupIds = content.spaces.map(space => space.id)
  const asker = await knex('users').where('id', userId).first('name')

  let answer
  try {
    answer = await (deps.assistantTurn || assistantTurnInChildProcess)({
      contentSummary: formatAssistantContent(content),
      allowedPostIds,
      allowedGroupIds,
      thread: earlier.map(item => ({ authorType: item.authorType, author: item.author?.name || '', text: item.text, parts: item.parts })),
      steward: asker?.name || '',
      message
    })
  } catch (err) {
    sails.log.error(`askGroupAssistant failed for group ${group.id}: ${err.message}`)
    throw new GraphQLError(`Axl could not answer: ${err.message}`)
  }

  // Checked again here, in the API process, whatever produced the answer
  const { parts } = sanitizeAssistantParts(answer.parts, { postIds: allowedPostIds, groupIds: allowedGroupIds })
  const [axlRow] = await knex('group_assistant_messages')
    .insert({
      group_id: group.id,
      author_type: 'axl',
      text: String(answer.text || '').slice(0, MAX_ASSISTANT_MESSAGE_LENGTH),
      parts: JSON.stringify(describeParts(parts, content)),
      posts_read: content.postsRead
    })
    .returning('id')

  const rows = await threadQuery(group.id).whereIn('group_assistant_messages.id', [stewardMessageId, axlRow.id || axlRow]).orderBy('group_assistant_messages.id', 'asc')
  return { messages: await withPostRefs(group, rows.map(presentMessage)), usage: answer.usage || null }
}

/**
 * Records that a steward posted one of the assistant's drafts, so every
 * steward sees it as "Posted". The post or comment was made by the steward
 * through the ordinary mutations; this checks it is theirs and is where the
 * draft pointed (a reply on the post the draft replied to, or a post in the
 * draft's space), then links it to the draft.
 */
export async function markGroupAssistantDraftPosted ({ userId, messageId, partIndex, postId, commentId }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const row = messageId ? await fetchMessage(messageId) : null
  if (!row) throw new GraphQLError('Message not found')
  await requireSteward(userId, row.group_id)

  const parts = Array.isArray(row.parts) ? row.parts : []
  const part = parts[partIndex]
  if (!part || part.type !== 'draft') throw new GraphQLError('That message has no draft there')
  if (part.posted) throw new GraphQLError('That draft was already posted')

  const knex = bookshelf.knex
  let posted
  if (part.replyToPostId) {
    const comment = commentId && await knex('comments').where({ id: commentId, user_id: userId, post_id: part.replyToPostId, active: true }).first('id')
    if (!comment) throw new GraphQLError('That reply was not found on the post the draft was for')
    posted = { commentId: String(comment.id), postId: String(part.replyToPostId) }
  } else {
    const post = postId && await knex('posts')
      .join('groups_posts', 'groups_posts.post_id', 'posts.id')
      .where({ 'posts.id': postId, 'posts.user_id': userId, 'posts.active': true, 'groups_posts.group_id': part.groupId })
      .first('posts.id')
    if (!post) throw new GraphQLError('That post was not found in the space the draft was for')
    posted = { postId: String(post.id) }
  }

  const poster = await knex('users').where('id', userId).first('name')
  parts[partIndex] = { ...part, posted: { ...posted, by: String(userId), byName: poster?.name || '', at: new Date().toISOString() } }
  await knex('group_assistant_messages').where('id', row.id).update({ parts: JSON.stringify(parts) })
  const [updated] = await withPostRefs(await Group.find(row.group_id), [presentMessage({ ...row, parts })])
  return updated
}
