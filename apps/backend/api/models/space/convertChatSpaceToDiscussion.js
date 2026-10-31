import { GraphQLError } from 'graphql'
import { chunk, escape, uniq } from 'lodash'
import { notifyGroupUpdated } from '../../graphql/mutations/notifyGroupUpdated'
import { groupAcceptsPostType, parseAcceptedPostTypes } from '../post/validatePostData'

const DEFAULT_QUEUE_THRESHOLD = 2000
const DEFAULT_BATCH_SIZE = 200
const CONVERTED_FROM = 'chat-conversion'

/**
 * How many chat messages are converted in the request before the rest is queued.
 * CHAT_CONVERSION_QUEUE_THRESHOLD overrides this for tests and ops.
 */
function queueThreshold () {
  const fromEnv = Number(process.env.CHAT_CONVERSION_QUEUE_THRESHOLD)
  return fromEnv > 0 ? fromEnv : DEFAULT_QUEUE_THRESHOLD
}

/**
 * Insert batch size. CHAT_CONVERSION_BATCH_SIZE overrides this for tests.
 */
function batchSize () {
  const fromEnv = Number(process.env.CHAT_CONVERSION_BATCH_SIZE)
  return fromEnv > 0 ? fromEnv : DEFAULT_BATCH_SIZE
}

/**
 * True when the space only accepts chat posts.
 * @param {*} acceptedPostTypes
 * @returns {boolean}
 */
export function isChatOnlyAcceptedTypes (acceptedPostTypes) {
  const types = parseAcceptedPostTypes(acceptedPostTypes)
  return Array.isArray(types) && types.length === 1 && types[0] === Post.Type.CHAT
}

/**
 * True when this space was already turned into a discussion and removed.
 * Those rows stay for audit but no longer block convertGroupToSpace.
 * @param {object} space
 * @returns {boolean}
 */
export function isConvertedArchivedSpace (space) {
  return Boolean(space.getSetting('chat_converted_to_post_id')) &&
    (space.get('status') === Group.Status.ARCHIVED || space.get('active') === false)
}

/**
 * Active child spaces that still block turning this group into a space.
 * @param {string|number} groupId
 * @returns {Promise<Array<{id: string, name: string, slug: string, chatOnly: boolean}>>}
 */
export async function listBlockingSpaces (groupId) {
  const spaces = await Group.query(q => {
    q.where({ parent_id: groupId, type: 'space', active: true })
  }).fetchAll()

  return spaces.models
    .filter(space => !isConvertedArchivedSpace(space))
    .map(space => ({
      id: String(space.id),
      name: space.get('name'),
      slug: space.get('slug'),
      chatOnly: isChatOnlyAcceptedTypes(space.get('accepted_post_types'))
    }))
}

/**
 * Active chat posts that belong to this space.
 * @param {string|number} spaceId
 * @param {object} [trx]
 */
function chatPostsQuery (spaceId, trx) {
  const query = bookshelf.knex('posts')
    .join('groups_posts', 'groups_posts.post_id', 'posts.id')
    .where('groups_posts.group_id', spaceId)
    .where('posts.active', true)
    .where('posts.type', Post.Type.CHAT)
  if (trx) query.transacting(trx)
  return query
}

/**
 * @param {import('knex').Knex.QueryBuilder} query
 * @returns {Promise<number>}
 */
async function countOf (query) {
  const row = await query.count('* as count').first()
  return Number(row?.count || 0)
}

/**
 * Counts for the confirm step. Does not write.
 * @param {string|number} spaceId
 * @param {object} [trx]
 */
async function loadPreview (spaceId, trx) {
  const statsQuery = chatPostsQuery(spaceId, trx)
    .select(bookshelf.knex.raw(
      'count(*)::int as message_count, count(distinct posts.user_id)::int as author_count, min(posts.created_at) as first_message_at, max(posts.created_at) as last_message_at'
    ))
  const stats = await statsQuery.first()
  const postIds = chatPostsQuery(spaceId, trx).select('posts.id')

  const attachmentCount = await countOf(
    bookshelf.knex('media').modify(q => { if (trx) q.transacting(trx) }).whereIn('post_id', postIds)
  )
  const reactionCount = await countOf(
    bookshelf.knex('reactions')
      .modify(q => { if (trx) q.transacting(trx) })
      .where({ entity_type: 'post' })
      .whereIn('entity_id', postIds)
  )
  const replyCount = await countOf(
    bookshelf.knex('comments')
      .modify(q => { if (trx) q.transacting(trx) })
      .where({ active: true })
      .whereIn('post_id', postIds)
  )

  return {
    messageCount: Number(stats?.message_count || 0),
    authorCount: Number(stats?.author_count || 0),
    attachmentCount,
    reactionCount,
    replyCount,
    firstMessageAt: stats?.first_message_at || null,
    lastMessageAt: stats?.last_message_at || null
  }
}

/**
 * Short HTML note stored as the discussion body.
 * @param {string} roomName
 * @returns {string}
 */
function conversionNote (roomName) {
  const date = new Date().toISOString().slice(0, 10)
  return `<p>Converted from the chat room &quot;${escape(roomName || '')}&quot; on ${date}.</p>`
}

/**
 * Refuse unless this is a chat-only space an administrator of the parent may convert.
 * @param {string|number} userId
 * @param {string|number} spaceId
 */
async function loadConvertibleSpace (userId, spaceId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!spaceId) throw new GraphQLError('No spaceId passed into function')

  const space = await Group.findActive(spaceId) || await Group.find(spaceId)
  if (!space || space.get('type') !== 'space') throw new GraphQLError('Space not found')
  if (space.get('active') === false || space.getSetting('chat_converted_to_post_id')) {
    if (space.getSetting('chat_converted_to_post_id')) {
      throw new GraphQLError('This chat room has already been converted to a discussion post')
    }
    throw new GraphQLError('Space not found')
  }

  const parentId = space.get('parent_id')
  if (!parentId) throw new GraphQLError('Space has no parent group')

  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError("You don't have permission to convert this chat room")
  }

  if (space.get('track_id') || space.get('funding_round_id')) {
    throw new GraphQLError('Track and funding round spaces cannot be converted to a discussion')
  }
  if (!isChatOnlyAcceptedTypes(space.get('accepted_post_types'))) {
    throw new GraphQLError('Only a chat room can be converted to a discussion post')
  }
  const parent = await Group.findActive(parentId)
  if (!parent) throw new GraphQLError('Parent group not found')
  if (parent.get('type') === 'space') {
    throw new GraphQLError('Cannot convert a chat room whose parent is itself a space')
  }
  if (!groupAcceptsPostType(parent.get('accepted_post_types'), Post.Type.DISCUSSION)) {
    throw new GraphQLError(`${parent.get('name')} does not accept discussion posts`)
  }

  return { space, parent }
}

/**
 * Attach a transaction when the caller has one.
 * @param {import('knex').Knex.QueryBuilder} query
 * @param {object} [trx]
 */
function applyTrx (query, trx) {
  if (trx) query.transacting(trx)
  return query
}

/**
 * Refuse when a chat message also belongs to another group. Other post types stay where they are.
 * @param {string|number} spaceId
 * @param {object} [trx]
 */
async function assertRoomIsConvertible (spaceId, trx) {
  const shared = await countOf(
    applyTrx(bookshelf.knex('groups_posts as other'), trx)
      .whereIn('other.post_id', chatPostsQuery(spaceId, trx).select('posts.id'))
      .whereNot('other.group_id', spaceId)
  )
  if (shared > 0) {
    throw new GraphQLError('Some messages in this chat room also belong to another group')
  }
}

/**
 * Create the discussion the chat messages will hang off of. Dated now, so it shows up as a new post. No notifications.
 * @param {object} opts
 */
async function createDiscussionPost ({ trx, userId, parentId, title, roomName }) {
  const now = new Date()
  const post = await Post.create({
    name: title,
    description: conversionNote(roomName),
    type: Post.Type.DISCUSSION,
    user_id: userId,
    created_from: CONVERTED_FROM,
    proposal_status: Post.Proposal_Status.CASUAL,
    active: true,
    is_public: false,
    created_at: now,
    updated_at: now
  }, { transacting: trx })

  await bookshelf.knex('groups_posts')
    .transacting(trx)
    .insert({ post_id: post.id, group_id: parentId })

  return post
}

/**
 * Insert comment rows for chat posts and return old-post to new-comment pairs, in message order.
 * @param {object} trx
 * @param {string|number} discussionId
 * @param {Array<object>} messages
 */
async function insertComments (trx, discussionId, messages) {
  const pairs = []
  for (const batch of chunk(messages, batchSize())) {
    const inserted = await bookshelf.knex('comments')
      .transacting(trx)
      .insert(batch.map(message => ({
        post_id: discussionId,
        user_id: message.user_id,
        text: message.description || '',
        created_at: message.created_at,
        edited_at: message.edited_at,
        active: true,
        recent: false,
        created_from: CONVERTED_FROM,
        comment_id: null
      })))
      .returning('id')

    inserted.forEach((row, index) => {
      pairs.push({
        oldPostId: batch[index].id,
        newCommentId: row && typeof row === 'object' ? row.id : row
      })
    })
  }
  return pairs
}

/**
 * Run one mapped update per batch so a large room does not become a single giant statement.
 * @param {object} trx
 * @param {Array<{oldPostId: *, newCommentId: *}>} pairs
 * @param {function(string): string} sqlForTuples
 * @param {Array<*>} [leadingBindings]
 */
async function updateInBatches (trx, pairs, sqlForTuples, leadingBindings = []) {
  for (const batch of chunk(pairs, batchSize())) {
    const tuples = batch.map(() => '(cast(? as bigint), cast(? as bigint))').join(', ')
    const bindings = leadingBindings.slice()
    batch.forEach(pair => {
      bindings.push(pair.oldPostId, pair.newCommentId)
    })
    await bookshelf.knex.raw(sqlForTuples(tuples), bindings).transacting(trx)
  }
}

/**
 * Point media, reactions and existing replies at the new comments, then hide the chat posts.
 * @param {object} opts
 */
async function moveMessages ({ trx, spaceId, discussion, userId, preview }) {
  const messages = await chatPostsQuery(spaceId, trx)
    .orderBy('posts.created_at', 'asc')
    .orderBy('posts.id', 'asc')
    .select('posts.id', 'posts.user_id', 'posts.description', 'posts.created_at', 'posts.edited_at')

  const pairs = await insertComments(trx, discussion.id, messages)

  if (pairs.length > 0) {
    await updateInBatches(trx, pairs, tuples => `
      update comments as c
      set post_id = ?,
          comment_id = coalesce(c.comment_id, map.new_comment_id)
      from (values ${tuples}) as map(old_post_id, new_comment_id)
      where c.post_id = map.old_post_id and c.active = true
    `, [discussion.id])

    await updateInBatches(trx, pairs, tuples => `
      update media as m
      set comment_id = map.new_comment_id, post_id = null
      from (values ${tuples}) as map(old_post_id, new_comment_id)
      where m.post_id = map.old_post_id
    `)

    await updateInBatches(trx, pairs, tuples => `
      update reactions as r
      set entity_type = 'comment', entity_id = map.new_comment_id
      from (values ${tuples}) as map(old_post_id, new_comment_id)
      where r.entity_type = 'post' and r.entity_id = map.old_post_id
    `)
  }

  await bookshelf.knex('posts')
    .transacting(trx)
    .whereIn('id', function () {
      this.select('post_id').from('groups_posts').where('group_id', spaceId)
    })
    .where('active', true)
    .whereIn('type', [Post.Type.CHAT, Post.Type.CHAT_ACTIVITY])
    .update({
      active: false,
      deactivated_at: new Date(),
      deactivated_reason: CONVERTED_FROM
    })

  const commentRows = await bookshelf.knex('comments')
    .transacting(trx)
    .where({ post_id: discussion.id, active: true })
    .select('user_id')
  const followerIds = uniq(commentRows.map(row => row.user_id).filter(Boolean).concat(userId).map(id => String(id)))
  if (followerIds.length > 0) {
    await discussion.addFollowers(followerIds, {}, { transacting: trx })
  }

  const numComments = await countOf(
    bookshelf.knex('comments').transacting(trx).where({ post_id: discussion.id, active: true })
  )
  const commenterRow = await bookshelf.knex('comments')
    .transacting(trx)
    .where({ post_id: discussion.id, active: true })
    .whereNotNull('user_id')
    .countDistinct('user_id as count')
    .first()

  const recentIds = await bookshelf.knex('comments')
    .transacting(trx)
    .where({ post_id: discussion.id, active: true })
    .orderBy('created_at', 'desc')
    .orderBy('id', 'desc')
    .limit(2)
    .pluck('id')
  if (recentIds.length > 0) {
    await bookshelf.knex('comments').transacting(trx).whereIn('id', recentIds).update({ recent: true })
  }

  const now = new Date()
  await bookshelf.knex('posts').transacting(trx).where({ id: discussion.id }).update({
    num_comments: numComments,
    num_commenters: Number(commenterRow?.count || 0),
    created_at: now,
    updated_at: now
  })

  return discussion.refresh({ transacting: trx })
}

/**
 * Merge conversion bookkeeping into the space settings jsonb.
 * @param {object} space
 * @param {object} patch
 * @param {object} trx
 */
async function saveSettings (space, patch, trx) {
  const settings = { ...(space.get('settings') || {}), ...patch }
  await space.save({ settings }, { patch: true, transacting: trx })
  return space
}

/**
 * Remove the chat room so it no longer blocks turning its parent into a space.
 * The row stays for audit: inactive, archived, and off the parent menu.
 * @param {object} space
 * @param {object} trx
 */
async function removeConvertedSpace (space, trx) {
  await space.save({
    status: Group.Status.ARCHIVED,
    active: false
  }, { patch: true, transacting: trx })
  const menuEntries = await GroupView.where({
    type: GroupView.Type.SPACE,
    linked_group_id: space.id
  }).fetchAll({ transacting: trx })

  let menuGroupId = null
  for (const entry of menuEntries.models) {
    menuGroupId = entry.get('group_id')
    await entry.destroy({ transacting: trx })
  }
  if (menuGroupId) await GroupView.syncMenuViewCount(menuGroupId, { transacting: trx })
}

/**
 * Drop a queued shell when the job could not be enqueued, so a retry can start clean.
 * @param {{spaceId: string|number, postId: string|number}} opts
 */
export async function abandonQueuedConversion ({ spaceId, postId }) {
  await bookshelf.transaction(async trx => {
    const space = await Group.where({ id: spaceId }).fetch({ transacting: trx })
    if (space) {
      const settings = { ...(space.get('settings') || {}) }
      delete settings.chat_conversion_status
      delete settings.chat_conversion_post_id
      await space.save({ settings }, { patch: true, transacting: trx })
    }
    if (postId) {
      await bookshelf.knex('posts').transacting(trx).where({ id: postId }).update({
        active: false,
        deactivated_at: new Date(),
        deactivated_reason: 'chat-conversion-abandoned'
      })
    }
  })
}

/**
 * Move messages into a discussion. Used by the sync path and the queue worker.
 * @param {object} opts
 */
async function performMove ({ trx, space, userId, title, postId, preview }) {
  const discussion = postId
    ? await Post.where({ id: postId }).fetch({ transacting: trx })
    : null
  if (postId && !discussion) throw new GraphQLError('Discussion post not found')

  const post = discussion || await createDiscussionPost({
    trx,
    userId,
    parentId: space.get('parent_id'),
    title,
    roomName: space.get('name')
  })

  await moveMessages({ trx, spaceId: space.id, discussion: post, userId, preview })
  await saveSettings(space, {
    chat_converted_to_post_id: String(post.id),
    chat_conversion_post_id: null,
    chat_conversion_status: null
  }, trx)
  await removeConvertedSpace(space, trx)
  return post
}

/**
 * Convert a chat-only space into one discussion in its parent group.
 * Dry runs return counts and write nothing. Large rooms create the post and return queued.
 * @param {string|number} userId
 * @param {object} opts
 */
export async function convertChatSpaceToDiscussion (userId, { spaceId, title, dryRun = false } = {}) {
  const { space, parent } = await loadConvertibleSpace(userId, spaceId)
  const trimmedTitle = typeof title === 'string' ? title.trim() : ''
  if (title != null && !trimmedTitle) throw new GraphQLError('Title cannot be blank')
  const discussionTitle = trimmedTitle || space.get('name')

  if (dryRun) {
    if (space.getSetting('chat_conversion_status') === 'pending') {
      throw new GraphQLError('This chat room is already being converted')
    }
    await assertRoomIsConvertible(space.id, null)
    const preview = await loadPreview(space.id)
    return { dryRun: true, queued: false, ...preview, post: null }
  }

  const outcome = await bookshelf.transaction(async trx => {
    await bookshelf.knex('groups').transacting(trx).where({ id: space.id }).forUpdate()
    const locked = await Group.where({ id: space.id }).fetch({ transacting: trx })
    const settings = locked.get('settings') || {}
    if (settings.chat_converted_to_post_id) {
      throw new GraphQLError('This chat room has already been converted to a discussion post')
    }
    if (settings.chat_conversion_status === 'pending') {
      throw new GraphQLError('This chat room is already being converted')
    }

    await assertRoomIsConvertible(locked.id, trx)
    const preview = await loadPreview(locked.id, trx)

    if (preview.messageCount > queueThreshold()) {
      const post = await createDiscussionPost({
        trx,
        userId,
        parentId: locked.get('parent_id'),
        title: discussionTitle,
        roomName: locked.get('name')
      })
      await saveSettings(locked, {
        chat_conversion_status: 'pending',
        chat_conversion_post_id: String(post.id)
      }, trx)
      return { dryRun: false, queued: true, ...preview, post: await post.refresh({ transacting: trx }) }
    }

    const post = await performMove({
      trx,
      space: locked,
      userId,
      title: discussionTitle,
      preview
    })
    return { dryRun: false, queued: false, ...preview, post }
  })

  return {
    ...outcome,
    space,
    parentGroup: parent,
    parentId: parent.id
  }
}

/**
 * Finish a queued conversion. Called by the worker as Group.convertChatSpaceMessages.
 * @param {{spaceId: string|number, postId: string|number, userId: string|number}} data
 */
export async function finishQueuedChatSpaceConversion ({ spaceId, postId, userId }) {
  const outcome = await bookshelf.transaction(async trx => {
    await bookshelf.knex('groups').transacting(trx).where({ id: spaceId }).forUpdate()
    const space = await Group.where({ id: spaceId }).fetch({ transacting: trx })
    if (!space) return null
    if (space.getSetting('chat_converted_to_post_id')) {
      return { parentId: space.get('parent_id'), done: true }
    }

    const preview = await loadPreview(space.id, trx)
    await performMove({
      trx,
      space,
      userId,
      title: space.get('name'),
      postId: postId || space.getSetting('chat_conversion_post_id'),
      preview
    })
    return { parentId: space.get('parent_id'), done: false }
  })

  if (!outcome) return null
  const parent = outcome.parentId ? await Group.find(outcome.parentId) : null
  const space = await Group.find(spaceId)
  if (parent) notifyGroupUpdated(null, parent, outcome.parentId)
  if (space) notifyGroupUpdated(null, space, spaceId)
  return space
}
