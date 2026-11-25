/* global bookshelf, Group, GroupMembership, Queue, Responsibility, sails */
import { GraphQLError } from 'graphql'
import {
  GROUP_ASSISTANT_PRO_FEATURE,
  MAX_ASSISTANT_MESSAGE_LENGTH,
  MAX_ASSISTANT_VOICE_LENGTH,
  sanitizeAssistantParts,
  sanitizeGroupAssistantSettings,
  validateGroupAssistantSettings
} from '@hylo/shared'
import { assistantTurnInChildProcess, isGroupAssistantConfigured, memberAnswerInChildProcess } from '../../../lib/groupAssistant'
import { assistantSpaceChoices, fetchAssistantContent, fetchChatForSummary, formatAssistantContent, formatChatForSummary, linkablePostIds, memberAliases } from '../../../lib/groupAssistantContent'
import { addAssistantAgreement, assistantConsentFor, consentingMemberIds, removeAssistantAgreement, setAssistantConsent } from '../../../lib/groupAssistantConsent'
import HyloProService from '../../services/HyloProService'
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
 * - The group's Hylo Pro must include the groupAssistant feature, and a steward
 *   must have turned the assistant on.
 * - Members' consent: while it is on, the group's agreements include the
 *   assistant's data-sharing agreement, and only the posts, replies and
 *   details of members who accepted it are ever sent (groupAssistantConsent.js).
 * - A steward's "How I write" note is theirs alone. It is kept on their own
 *   membership of the group, returned only to them, and given to the model
 *   only for a turn they ask for themselves.
 * - Nothing the model returns changes anything: its answer is stored as a
 *   message. A draft becomes a post only when a steward posts it themselves,
 *   through the ordinary post and comment mutations, under their own name.
 */

export const HYLO_PRO_REQUIRED_FOR_ASSISTANT = 'The Group Assistant is part of Hylo Pro. This group needs Hylo Pro to use it.'
const TURNS_PER_GROUP_PER_HOUR = 60
// A member's chat summaries and questions, on top of the group's own hourly limit
const MEMBER_REQUESTS_PER_HOUR = 10
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

// The group's Hylo Pro must include the assistant (Q-82): HYLO_PRO_REQUIRED without Pro,
// HYLO_PRO_FEATURE_REQUIRED when its plan leaves the assistant out
const requireAssistantFeature = async group => HyloProService.requireProFeature(
  group,
  GROUP_ASSISTANT_PRO_FEATURE,
  (await group.hasPro()) ? 'This group\'s Hylo Pro plan doesn\'t include the Group Assistant.' : HYLO_PRO_REQUIRED_FOR_ASSISTANT
)

const storedSettings = group => sanitizeGroupAssistantSettings((group.get('settings') || {}).assistant)

async function withinHourlyLimit (key, limit) {
  try {
    const redis = RedisClient.create()
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60 * 60)
    return count <= limit
  } catch (err) {
    sails.log.error(`groupAssistant withinHourlyLimit failed: ${err.message}`)
    return true
  }
}

// Where a per-group token cap (#1795) would go: check the group's remaining tokens here, before
// the model is called, and record each answer's `usage` after it (both ask and the member requests
// go through this and get usage back from the model call).
const withinTurnLimit = groupId => withinHourlyLimit(`ratelimit:groupAssistant:group:${groupId}`, TURNS_PER_GROUP_PER_HOUR)

const saveStewardVoice = (userId, groupId, voice) => bookshelf.knex('group_memberships').where({ user_id: userId, group_id: groupId }).update({
  // Only this key, in one statement, so other membership settings are not overwritten
  settings: bookshelf.knex.raw("jsonb_set(COALESCE(settings, '{}'::jsonb), '{assistantVoice}', ?::jsonb)", [JSON.stringify(voice)])
})

/** This steward's own "How I write" note for this group, or ''. */
async function stewardVoice (userId, groupId) {
  const row = await bookshelf.knex('group_memberships').where({ user_id: userId, group_id: groupId }).first('settings')
  const voice = row?.settings?.assistantVoice
  return typeof voice === 'string' ? voice.slice(0, MAX_ASSISTANT_VOICE_LENGTH) : ''
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

/**
 * Adds needsJoin to each draft that is not posted yet and that this steward
 * cannot post as it stands, because they are not a member of the space it is
 * for. A steward can join any space of their group, so the screen offers that
 * with the post instead of failing. Worked out for whoever is reading.
 */
async function withDraftAccess (group, userId, messages) {
  const open = messages.flatMap(message => (message.parts || []).filter(part => part.type === 'draft' && !part.posted))
  if (open.length === 0 || !userId) return messages
  const knex = bookshelf.knex
  const spaces = await assistantSpaceChoices(group.id)
  const spaceIds = spaces.map(space => space.id)
  const memberOf = new Set((await knex('group_memberships')
    .where({ user_id: userId, active: true }).whereIn('group_id', spaceIds).pluck('group_id')).map(String))
  const replyPostIds = [...new Set(open.map(part => part.replyToPostId).filter(Boolean))]
  const postSpaces = replyPostIds.length === 0
    ? []
    : await knex('groups_posts').whereIn('post_id', replyPostIds).whereIn('group_id', spaceIds).select('post_id', 'group_id')

  const joinFor = part => {
    const targets = part.replyToPostId
      ? postSpaces.filter(row => String(row.post_id) === String(part.replyToPostId)).map(row => String(row.group_id))
      : [String(part.groupId)]
    if (targets.length === 0 || targets.some(id => memberOf.has(id))) return null
    const space = spaces.find(item => item.id === targets[0] && !item.isGroup)
    return space ? { spaceId: space.id, name: space.name } : null
  }
  return messages.map(message => ({
    ...message,
    parts: (message.parts || []).map(part => {
      const needsJoin = part.type === 'draft' && !part.posted ? joinFor(part) : null
      return needsJoin ? { ...part, needsJoin } : part
    })
  }))
}

/**
 * A change Axl offered to one steward's "How I write" note is theirs alone:
 * every other steward gets an empty placeholder in its place, which keeps the
 * positions of the other parts and shows nothing.
 */
const withOwnVoiceNotes = (userId, messages) => messages.map(message => ({
  ...message,
  parts: (message.parts || []).map(part => part.type === 'voiceNote' && String(part.forUserId) !== String(userId)
    ? { type: 'voiceNote', hidden: true }
    : part)
}))

/** What a steward is shown of these messages: linked post ids, which drafts need them to join a space first, and only their own note offers. */
const forSteward = async (group, userId, messages) => withOwnVoiceNotes(userId, await withDraftAccess(group, userId, await withPostRefs(group, messages)))

/** The newest messages of a group's thread, oldest first. */
async function fetchThread (groupId, limit = THREAD_PAGE) {
  const rows = await threadQuery(groupId).orderBy('group_assistant_messages.id', 'desc').limit(limit)
  return rows.reverse().map(presentMessage)
}

/** The newest messages of the thread the model is given, as stored, oldest first. */
const fetchThreadRows = async groupId => (await threadQuery(groupId).orderBy('group_assistant_messages.id', 'desc').limit(HISTORY_FOR_MODEL)).reverse()

/**
 * Rows from fetchThreadRows as the model is given them. Axl's messages are stored with the names
 * of members who do not share put back in (member_refs lists them), so those names, and any full
 * name of such a member a steward typed, become aliases again here.
 */
function threadForModel (rows, aliases) {
  return rows.map(row => {
    const refs = Array.isArray(row.member_refs) ? row.member_refs : []
    return {
      authorType: row.author_type,
      author: aliases.person(row.user_id, row.author_name || ''),
      text: aliases.forModel(row.text, refs),
      parts: mapPartTexts(Array.isArray(row.parts) ? row.parts : [], text => aliases.forModel(text, refs))
    }
  })
}

/** Every piece of text in a message's parts passed through fn, in place of the original. */
function mapPartTexts (parts, fn) {
  const textKeys = ['text', 'title', 'forName', 'replyToTitle', 'author']
  return (parts || []).map(part => {
    const out = { ...part }
    for (const key of textKeys) if (typeof out[key] === 'string') out[key] = fn(out[key])
    if (Array.isArray(out.items)) out.items = out.items.map(item => typeof item === 'string' ? fn(item) : item)
    if (Array.isArray(out.steps)) out.steps = out.steps.map(step => ({ ...step, title: fn(step.title || ''), line: fn(step.line || '') }))
    if (out.posted && typeof out.posted.byName === 'string') out.posted = { ...out.posted, byName: fn(out.posted.byName) }
    return out
  })
}

/** The texts of a message's parts, for finding aliases in them. */
const partTexts = parts => {
  const texts = []
  mapPartTexts(parts, text => { texts.push(text); return text })
  return texts
}

async function fetchMessage (id) {
  if (!/^[1-9][0-9]{0,18}$/.test(String(id))) return null
  return (await messagesQuery().where('group_assistant_messages.id', id).first()) || null
}

async function stewardNames (group) {
  const stewards = await group.membersWithResponsibilities([Responsibility.constants.RESP_ADMINISTRATION]).fetch()
  return stewards.map(user => ({ id: String(user.id), name: user.get('name') || '' }))
}

async function consentCounts (groupId) {
  const members = await bookshelf.knex('group_memberships')
    .join('users', 'users.id', 'group_memberships.user_id')
    .where({ 'group_memberships.group_id': groupId, 'group_memberships.active': true, 'users.active': true })
    .count('* as count').first()
  return { agreed: (await consentingMemberIds(groupId)).size, members: Number(members?.count) || 0 }
}

/** Everything the assistant screen and its settings card need, for a steward. */
async function presentAssistant (group, userId, { withThread = true } = {}) {
  const hasPro = await group.hasPro()
  const hasFeature = await group.hasProFeature(GROUP_ASSISTANT_PRO_FEATURE)
  const settings = storedSettings(group)
  const spaces = await assistantSpaceChoices(group.id)
  // A space that was deleted or archived out of the group stops counting at once
  const choiceIds = new Set(spaces.map(space => space.id))
  settings.readableGroupIds = settings.readableGroupIds.filter(id => choiceIds.has(id))
  return {
    hasPro,
    hasFeature,
    configured: isGroupAssistantConfigured(),
    // How many members have agreed to share with the assistant, of how many
    consent: settings.enabled ? await consentCounts(group.id) : null,
    settings,
    spaces,
    stewards: await stewardNames(group),
    myVoice: await stewardVoice(userId, group.id),
    myVoiceMaxLength: MAX_ASSISTANT_VOICE_LENGTH,
    messages: withThread && hasFeature && settings.enabled ? await forSteward(group, userId, await fetchThread(group.id)) : []
  }
}

/**
 * The assistant's settings, the spaces it could read, the stewards who share
 * the thread, and the thread itself. Stewards only. Works without Hylo Pro
 * (the settings card shows as locked), but returns no messages then.
 */
export async function groupAssistant ({ userId, groupId }) {
  const group = await requireSteward(userId, groupId)
  return presentAssistant(group, userId)
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
  if (clean.enabled) await requireAssistantFeature(group)

  const choiceIds = new Set((await assistantSpaceChoices(group.id)).map(space => space.id))
  const outside = clean.readableGroupIds.filter(id => !choiceIds.has(id))
  if (outside.length > 0) throw new GraphQLError('The assistant can only read this group and its own spaces')

  // Update only the assistant key in one statement, so a concurrent change to another setting is not overwritten
  await bookshelf.knex('groups').where('id', group.id).update({
    settings: bookshelf.knex.raw("jsonb_set(COALESCE(settings, '{}'::jsonb), '{assistant}', ?::jsonb)", [JSON.stringify({ ...clean, updatedBy: String(userId), updatedAt: new Date().toISOString() })]),
    updated_at: new Date()
  })

  // Members' consent: while it is on, the group's agreements ask every member whether their
  // content may be shared. Adding it marks the agreements as changed (the regular prompt) and
  // tells the members; turning the assistant off takes the agreement away again.
  if (clean.enabled) {
    const added = await addAssistantAgreement(group, userId)
    if (added) Queue.classMethod('Group', 'notifyMembersOfAssistantAgreement', { groupId: group.id, actorId: userId })
  } else {
    await removeAssistantAgreement(group)
  }
  return presentAssistant(await group.refresh(), userId)
}

/**
 * Saves the calling steward's own "How I write" note for this group: how they
 * want drafts worded when the assistant writes for them. Only they ever get it
 * back. An empty note clears it. Returns { myVoice }.
 */
export async function updateGroupAssistantVoice ({ userId, groupId, text }) {
  const group = await requireSteward(userId, groupId)
  const voice = typeof text === 'string' ? text.trim() : ''
  if (voice.length > MAX_ASSISTANT_VOICE_LENGTH) throw new GraphQLError(`Your note can be up to ${MAX_ASSISTANT_VOICE_LENGTH} characters`)
  await saveStewardVoice(userId, group.id, voice)
  return { myVoice: voice }
}

/**
 * Saves a change to their "How I write" note that Axl offered a steward in the
 * thread, as offered or as they edited it. Only the steward it was offered to
 * can save it, and it replaces their whole note. Returns { message, myVoice }.
 */
export async function saveGroupAssistantVoiceNote ({ userId, messageId, partIndex, text }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const row = messageId ? await fetchMessage(messageId) : null
  if (!row) throw new GraphQLError('Message not found')
  const group = await requireSteward(userId, row.group_id)

  const parts = Array.isArray(row.parts) ? row.parts : []
  const part = parts[partIndex]
  if (!part || part.type !== 'voiceNote') throw new GraphQLError('That message has no note to save there')
  if (String(part.forUserId) !== String(userId)) throw new GraphQLError('That note was offered to another steward')
  if (part.saved) throw new GraphQLError('That note was already saved')
  const voice = (typeof text === 'string' ? text : part.text).trim()
  if (!voice) throw new GraphQLError('Write a note first')
  if (voice.length > MAX_ASSISTANT_VOICE_LENGTH) throw new GraphQLError(`Your note can be up to ${MAX_ASSISTANT_VOICE_LENGTH} characters`)

  await saveStewardVoice(userId, group.id, voice)
  parts[partIndex] = { ...part, text: voice, saved: { at: new Date().toISOString() } }
  await bookshelf.knex('group_assistant_messages').where('id', row.id).update({ parts: JSON.stringify(parts) })
  const [message] = await forSteward(group, userId, [presentMessage({ ...row, parts })])
  return { message, myVoice: voice }
}

/**
 * Adds to each part what the screen needs to show it without another request:
 * a snapshot of a quoted post, and where a draft would be posted.
 */
function describeParts (parts, content, asker = {}) {
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
    // An offered note is for the steward who asked, and for nobody else
    if (part.type === 'voiceNote') return { ...part, forUserId: String(asker.id), forName: asker.name || '' }
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
  await requireAssistantFeature(group)
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
  const earlierRows = await fetchThreadRows(group.id)
  const [stewardRow] = await knex('group_assistant_messages')
    .insert({ group_id: group.id, author_type: 'steward', user_id: userId, text: message })
    .returning('id')
  const stewardMessageId = stewardRow.id || stewardRow

  // The only content the model sees: what the stewards chose, selected in the database
  const abilities = { followUps: settings.followUps, shareLoad: settings.shareLoad }
  const content = await (deps.fetchContent || fetchAssistantContent)({ group, readableGroupIds: settings.readableGroupIds, includeMembers: settings.readMembers, abilities })
  // Members who do not share are named by an alias in everything the model is given (A-10)
  const aliases = content.aliases || memberAliases()
  const earlier = threadForModel(earlierRows, aliases)

  const allowedPostIds = content.posts.map(post => post.id)
  const allowedGroupIds = content.spaces.map(space => space.id)
  const asker = await knex('users').where('id', userId).first('name')

  let answer
  try {
    answer = await (deps.assistantTurn || assistantTurnInChildProcess)({
      contentSummary: formatAssistantContent(content),
      allowedPostIds,
      allowedGroupIds,
      thread: earlier,
      steward: aliases.person(userId, asker?.name || ''),
      voice: aliases.names(await stewardVoice(userId, group.id)),
      message: aliases.names(message),
      abilities
    })
  } catch (err) {
    sails.log.error(`askGroupAssistant failed for group ${group.id}: ${err.message}`)
    throw new GraphQLError(`Axl could not answer: ${err.message}`)
  }

  // Checked again here, in the API process, whatever produced the answer
  const { parts } = sanitizeAssistantParts(answer.parts, { postIds: allowedPostIds, groupIds: allowedGroupIds })
  // The stewards see members' real names: each alias is swapped back before the answer is stored.
  // member_refs records whose names were put back, so the next turn can alias them again.
  const described = describeParts(parts, content, { id: userId, name: asker?.name })
  const memberRefs = aliases.referencedIn([answer.text, ...partTexts(described)])
  const [axlRow] = await knex('group_assistant_messages')
    .insert({
      group_id: group.id,
      author_type: 'axl',
      text: String(aliases.restore(String(answer.text || ''))).slice(0, MAX_ASSISTANT_MESSAGE_LENGTH),
      parts: JSON.stringify(mapPartTexts(described, text => aliases.restore(text))),
      member_refs: JSON.stringify(memberRefs),
      posts_read: content.postsRead
    })
    .returning('id')

  const rows = await threadQuery(group.id).whereIn('group_assistant_messages.id', [stewardMessageId, axlRow.id || axlRow]).orderBy('group_assistant_messages.id', 'asc')
  return { messages: await forSteward(group, userId, rows.map(presentMessage)), usage: answer.usage || null }
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
  const [updated] = await forSteward(await Group.find(row.group_id), userId, [presentMessage({ ...row, parts })])
  return updated
}

// ---------- Members ----------

/** The group whose assistant covers groupId: the group itself, or a space's parent group. */
async function assistantGroupFor (groupId) {
  const group = groupId ? await Group.find(groupId) : null
  if (!group) throw new GraphQLError('Group not found')
  if (group.get('type') !== 'space') return { group, place: group }
  const parent = group.get('parent_id') ? await Group.find(group.get('parent_id')) : null
  if (!parent) throw new GraphQLError('Group not found')
  return { group: parent, place: group }
}

const isActiveMember = async (userId, groupId) => !!(await bookshelf.knex('group_memberships').where({ user_id: userId, group_id: groupId, active: true }).first('id'))

/**
 * What the Group Assistant means for one member of a group or space, for the web:
 * { consent, summarize, answerMembers }. consent is their answer to the data-sharing agreement
 * ('accepted', 'declined' or 'pending'), or null when the assistant is off. summarize is whether
 * they can ask for a summary of this group's or space's chat, answerMembers whether they can ask
 * the assistant a question about the group. Null for someone who is not a member.
 */
export async function assistantForMember (userId, groupOrSpace) {
  if (!userId || !groupOrSpace) return null
  const { group, place } = await assistantGroupFor(groupOrSpace.id)
  if (!(await isActiveMember(userId, place.id))) return null
  const settings = storedSettings(group)
  const off = { consent: null, summarize: false, answerMembers: false }
  if (!settings.enabled) return off
  const consent = await assistantConsentFor(userId, group.id)
  if (!(await group.hasProFeature(GROUP_ASSISTANT_PRO_FEATURE)) || !isGroupAssistantConfigured()) return { ...off, consent }
  return {
    consent,
    summarize: settings.summarize && settings.readableGroupIds.includes(String(place.id)),
    answerMembers: settings.answerMembers && place.id === group.id
  }
}

/** A member answers the assistant's data-sharing agreement for themselves: accepted true or false. */
export async function setGroupAssistantConsent ({ userId, groupId, accepted }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const { group } = await assistantGroupFor(groupId)
  if (!(await isActiveMember(userId, group.id))) throw new GraphQLError('Only members of this group can answer its agreements')
  try {
    return { consent: await setAssistantConsent(userId, group.id, !!accepted) }
  } catch (err) {
    throw new GraphQLError(err.message)
  }
}

async function requireMemberAbility (userId, groupId, ability, deps) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const { group, place } = await assistantGroupFor(groupId)
  if (!(await isActiveMember(userId, place.id))) throw new GraphQLError('Only members can ask the Group Assistant')
  await requireAssistantFeature(group)
  const settings = storedSettings(group)
  if (!settings.enabled || !settings[ability]) throw new GraphQLError('The stewards have not turned this on for this group')
  if (!(deps.isConfigured || isGroupAssistantConfigured)()) throw new GraphQLError('The Group Assistant is not set up on this server')
  const limited = deps.withinLimit
    ? !(await deps.withinLimit(group.id))
    : !(await withinHourlyLimit(`ratelimit:groupAssistant:member:${userId}`, MEMBER_REQUESTS_PER_HOUR)) || !(await withinTurnLimit(group.id))
  if (limited) throw new GraphQLError('The Group Assistant has been asked a lot in the last hour. Please try again later.')
  return { group, place, settings }
}

/**
 * "Catch me up" in a chat room (the "Summarize busy chats" ability): a summary of the chat
 * messages in a group or space since sincePostId (the member's last read message), or from the
 * last day. Only for a space the stewards let the assistant read, and only messages from members
 * who agreed to share. Returns { text, messagesRead, notShared }. Nothing is stored.
 */
export async function summarizeGroupChat ({ userId, groupId, sincePostId }, deps = {}) {
  const { group, place, settings } = await requireMemberAbility(userId, groupId, 'summarize', deps)
  if (!settings.readableGroupIds.includes(String(place.id))) throw new GraphQLError('The stewards have not let the assistant read this chat')
  const chat = await fetchChatForSummary({ assistantGroupId: group.id, chatGroupId: place.id, sincePostId })
  if (chat.messages.length === 0) return { text: '', messagesRead: 0, notShared: chat.notShared }
  try {
    const answer = await (deps.memberAnswer || memberAnswerInChildProcess)({
      kind: 'summary',
      contentSummary: formatChatForSummary({ spaceName: place.get('name') || '', ...chat }),
      allowedPostIds: chat.messages.map(message => message.id)
    })
    // The member can read this chat themselves, so the names behind the aliases are no news to them
    return { text: chat.aliases ? chat.aliases.restore(answer.text) : answer.text, messagesRead: chat.messages.length, notShared: chat.notShared }
  } catch (err) {
    sails.log.error(`summarizeGroupChat failed for group ${place.id}: ${err.message}`)
    throw new GraphQLError(`Axl could not answer: ${err.message}`)
  }
}

/**
 * A member asks the assistant a question about the group (the "Answer members' questions"
 * ability). Answered from the group's About text, agreements and the posts the stewards let it
 * read, from members who agreed to share; never the member list. Returns
 * { text, posts: [{ id, title }] }: the posts the answer relied on. Nothing is stored.
 */
export async function askGroupQuestion ({ userId, groupId, text }, deps = {}) {
  const question = typeof text === 'string' ? text.trim() : ''
  if (!question) throw new GraphQLError('Write a question first')
  if (question.length > MAX_ASSISTANT_MESSAGE_LENGTH) throw new GraphQLError(`A question can be up to ${MAX_ASSISTANT_MESSAGE_LENGTH} characters`)
  const { group, settings } = await requireMemberAbility(userId, groupId, 'answerMembers', deps)
  const content = await (deps.fetchContent || fetchAssistantContent)({ group, readableGroupIds: settings.readableGroupIds, includeMembers: false })
  const aliases = content.aliases || memberAliases()
  try {
    const answer = await (deps.memberAnswer || memberAnswerInChildProcess)({
      kind: 'answer',
      contentSummary: formatAssistantContent(content),
      question: aliases.names(question),
      allowedPostIds: content.posts.map(post => post.id)
    })
    // The member can read these posts themselves, so the names behind the aliases are no news to them
    const posts = answer.postIds
      .map(id => content.posts.find(post => post.id === id))
      .filter(Boolean)
      .map(post => ({ id: post.id, title: aliases.restore(post.title || post.text.slice(0, 80)) }))
    return { text: aliases.restore(answer.text), posts }
  } catch (err) {
    sails.log.error(`askGroupQuestion failed for group ${group.id}: ${err.message}`)
    throw new GraphQLError(`Axl could not answer: ${err.message}`)
  }
}
