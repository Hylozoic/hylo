import { GraphQLError } from 'graphql'
import { notifyGroupUpdated } from './notifyGroupUpdated'
import { recountPostTypesForView, TextHelpers, validateDesignedView } from '@hylo/shared'
import { designViewTurnInChildProcess, isViewDesignConfigured, normalizeDesignMessages } from '../../../lib/designedViewDesign'
import RedisClient from '../../services/RedisClient'

// Spaces & Views mutations — see docs/spaces-and-views-engineering-spec.md section 4.4

/** node-pg binds a JS array as a Postgres array type; in jsonb that becomes `{}` for []. */
function topicsForJsonb (topics) {
  return JSON.stringify(topics ?? [])
}

/** Adds https:// to a stored link when the user omitted a scheme. */
function sanitizedLink (link) {
  if (link === undefined) return undefined
  if (link == null || link === '') return link
  const trimmed = String(link).trim()
  return TextHelpers.sanitizeURL(trimmed) || trimmed
}

async function requireAdmin (userId, groupId, action) {
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (!responsibilities.includes(Responsibility.constants.RESP_ADMINISTRATION)) {
    throw new GraphQLError(`You don't have permission to ${action} for this group`)
  }
}

/** Admins and content moderators can curate posts in collection views. */
async function requireAdminOrManageContent (userId, groupId, action) {
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  const { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } = Responsibility.constants
  if (!responsibilities.includes(RESP_ADMINISTRATION) && !responsibilities.includes(RESP_MANAGE_CONTENT)) {
    throw new GraphQLError(`You don't have permission to ${action} for this group`)
  }
}

export const HYLO_PRO_REQUIRED_FOR_DESIGNED_VIEWS = 'Designed views are part of Hylo Pro. This group needs Hylo Pro to design or change one.'

/**
 * Designed views are a Hylo Pro feature: designing, creating and changing one
 * need an active subscription or grant. A view made while the group had Pro
 * keeps showing after Pro lapses, and can still be renamed, moved or deleted.
 */
async function requireHyloProForDesignedViews (groupId) {
  const group = await Group.find(groupId)
  if (!group || !(await group.hasPro())) {
    throw new GraphQLError(HYLO_PRO_REQUIRED_FOR_DESIGNED_VIEWS, { extensions: { code: 'HYLO_PRO_REQUIRED' } })
  }
  return group
}

/**
 * The settings to store for a designed view: only its design, checked against
 * the block format so nothing but known blocks is ever saved.
 */
function designedViewSettings (settings) {
  const { view, errors } = validateDesignedView(settings?.design)
  if (errors.length > 0) throw new GraphQLError(`Invalid design: ${errors.slice(0, 5).join('; ')}`)
  return { design: view }
}

export async function createGroupView ({ userId, groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, viewUserId, hidden, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')
  if (!type) throw new GraphQLError('No type passed into function')

  await requireAdmin(userId, groupId, 'create views')

  if (type === GroupView.Type.DESIGNED) {
    await requireHyloProForDesignedViews(groupId)
    settings = designedViewSettings(settings)
  }

  // Only space rows can live off-menu (More Spaces). Views are in the menu or deleted.
  if (hidden && type !== GroupView.Type.SPACE) {
    throw new GraphQLError('Only spaces can be added off-menu')
  }

  const attrs = {
    group_id: groupId,
    type,
    name,
    icon,
    settings,
    link: sanitizedLink(link),
    page_content: pageContent,
    topics: topicsForJsonb(topics),
    linked_group_id: linkedGroupId,
    post_id: postId,
    user_id: viewUserId
  }

  const view = await (hidden
    ? GroupView.createOffMenu(attrs)
    : GroupView.appendToMenu(attrs)
  ).catch(err => {
    throw new GraphQLError(`Creation of view failed: ${err.message}`)
  })

  if (!hidden && orderInFrontOfViewId) {
    await GroupView.reorder({ id: view.id, orderInFrontOfViewId, addToEnd })
  }

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return GroupView.where({ id: view.id }).fetch()
}

export async function updateGroupView ({ userId, id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No view id passed into function')

  const view = await GroupView.where({ id }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const groupId = view.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  const { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } = Responsibility.constants
  const isAdmin = responsibilities.includes(RESP_ADMINISTRATION)
  const incomingSettings = settings
  const hasOtherViewFields = name !== undefined || icon !== undefined || link !== undefined ||
    pageContent !== undefined || topics !== undefined || orderInFrontOfViewId || addToEnd
  const isSpaceCollectionSpaceIdsUpdate = view.get('type') === GroupView.Type.SPACE_COLLECTION &&
    incomingSettings != null &&
    Array.isArray(incomingSettings.spaceIds) &&
    !hasOtherViewFields

  if (!isAdmin) {
    if (!responsibilities.includes(RESP_MANAGE_CONTENT) || !isSpaceCollectionSpaceIdsUpdate) {
      throw new GraphQLError("You don't have permission to update views for this group")
    }
  }

  if (view.get('type') === GroupView.Type.DESIGNED && settings !== undefined) {
    await requireHyloProForDesignedViews(groupId)
    settings = designedViewSettings(settings)
  }

  const changes = {}
  if (name !== undefined) changes.name = name
  if (icon !== undefined) changes.icon = icon
  if (settings !== undefined) {
    if (!isAdmin && isSpaceCollectionSpaceIdsUpdate) {
      const currentSettings = view.get('settings') || {}
      changes.settings = {
        ...currentSettings,
        spaceIds: incomingSettings.spaceIds.map(spaceId => String(spaceId))
      }
    } else {
      changes.settings = settings
    }
  }
  if (link !== undefined) changes.link = sanitizedLink(link)
  if (pageContent !== undefined) changes.page_content = pageContent
  if (topics !== undefined) changes.topics = topicsForJsonb(topics)

  await view.save({ ...changes, updated_at: new Date() }, { patch: true })
    .catch(err => {
      throw new GraphQLError(`Update of view failed: ${err.message}`)
    })

  if (orderInFrontOfViewId || addToEnd) {
    await GroupView.reorder({ id, orderInFrontOfViewId, addToEnd })
  }

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return GroupView.where({ id }).fetch()
}

export async function deleteGroupView (userId, id, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No view id passed into function')

  const view = await GroupView.where({ id }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const groupId = view.get('group_id')
  await requireAdmin(userId, groupId, 'delete views')

  if (view.get('order') === 0) {
    throw new GraphQLError('Cannot delete the home view — set another view as home first')
  }
  const viewType = view.get('type')
  if (['track-actions', 'funding-round-submissions'].includes(viewType)) {
    throw new GraphQLError('This view cannot be deleted')
  }

  await bookshelf.transaction(async trx => {
    await view.destroy({ transacting: trx })
    const remaining = await GroupView.findForGroup(groupId, { transacting: trx })
    await GroupView.applyOrder(remaining.map(v => Number(v.id)), { groupId, trx })
    await GroupView.syncMenuViewCount(groupId, { transacting: trx })
  }).catch(err => {
    throw new GraphQLError(`Deletion of view failed: ${err.message}`)
  })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return { success: true }
}

export async function reorderGroupView (userId, id, orderInFrontOfViewId, addToEnd, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No view id passed into function')

  const view = await GroupView.where({ id }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const groupId = view.get('group_id')
  await requireAdmin(userId, groupId, 'reorder views')

  await GroupView.reorder({ id, orderInFrontOfViewId, addToEnd })
    .catch(err => {
      throw new GraphQLError(`Reordering of view failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return { success: true }
}

/**
 * Hide or show a space in the parent group's menu.
 * Hidden spaces keep their content (order = null) and appear in More Spaces.
 * Showing appends the space to the end of the ordered menu.
 * Views cannot be hidden — delete them instead.
 */
export async function setGroupViewHidden (userId, id, hidden, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No view id passed into function')
  if (typeof hidden !== 'boolean') throw new GraphQLError('hidden must be a boolean')

  const view = await GroupView.where({ id }).fetch()
  if (!view) throw new GraphQLError('View not found')

  if (view.get('type') !== GroupView.Type.SPACE) {
    throw new GraphQLError('Only spaces can be hidden from the menu')
  }

  const groupId = view.get('group_id')
  await requireAdmin(userId, groupId, 'update views')

  const currentOrder = view.get('order')

  if (hidden) {
    if (currentOrder === 0) {
      throw new GraphQLError('Cannot hide the home view — set another view as home first')
    }
    if (currentOrder == null) {
      return view
    }

    await bookshelf.transaction(async trx => {
      await view.save({ order: null, updated_at: new Date() }, { patch: true, transacting: trx })
      const remaining = await GroupView.findForGroup(groupId, { transacting: trx })
      const ids = remaining.map(v => Number(v.id))
      await GroupView.applyOrder(ids, { groupId, trx })
      await GroupView.syncMenuViewCount(groupId, { transacting: trx })
    })
  } else {
    if (currentOrder != null) {
      return view
    }

    const maxOrderRow = await bookshelf.knex('group_views')
      .where({ group_id: groupId })
      .whereNotNull('order')
      .max('order as max_order')
      .first()
    const nextOrder = maxOrderRow && maxOrderRow.max_order != null ? Number(maxOrderRow.max_order) + 1 : 0
    await view.save({ order: nextOrder, updated_at: new Date() }, { patch: true })
    await GroupView.syncMenuViewCount(groupId)
  }

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return GroupView.where({ id }).fetch()
}

export async function setHomeView (userId, viewId, groupId, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!viewId) throw new GraphQLError('No viewId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')

  await requireAdmin(userId, groupId, "modify this group's menu")

  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view || String(view.get('group_id')) !== String(groupId)) {
    throw new GraphQLError('View not found in this group')
  }

  if (GroupView.NON_NAVIGABLE_TYPES.includes(view.get('type'))) {
    throw new GraphQLError('This view cannot be set as the home view')
  }

  await GroupView.setHomeView({ id: viewId, groupId })
    .catch(err => {
      throw new GraphQLError(`Setting home view failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return { success: true }
}

/**
 * Update the current user's per-view unread state.
 * Sets lastReadPostId and recalculates newPostCount for that view's post types
 * (chat-visible types for chat; matching types for typed common views; 0 otherwise).
 * Returns the updated GroupView so the frontend ORM is refreshed in one round-trip.
 */
export async function updateGroupViewUser (userId, viewId, { lastReadPostId } = {}) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!viewId) throw new GraphQLError('No viewId passed into function')

  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const viewUser = await GroupViewUser.findOrCreate(viewId, userId)
  const updates = { updated_at: new Date() }

  if (lastReadPostId != null) {
    // Socket mark-read can race createPost's transaction: the id is on the
    // client before posts is committed, which trips last_read_post_id_foreign.
    const postExists = await bookshelf.knex('posts').where('id', lastReadPostId).first('id')
    if (postExists) {
      updates.last_read_post_id = lastReadPostId
      const groupId = view.get('group_id')
      const postTypes = recountPostTypesForView(view.get('type'))

      if (!postTypes) {
        updates.new_post_count = 0
      } else {
        const newPostCount = await bookshelf.knex('posts')
          .join('groups_posts', 'posts.id', 'groups_posts.post_id')
          .where('groups_posts.group_id', groupId)
          .whereIn('posts.type', postTypes)
          .where('posts.id', '>', lastReadPostId)
          .whereNull('posts.deactivated_at')
          .count('posts.id as count')
          .then(rows => parseInt(rows[0]?.count || 0))
        updates.new_post_count = newPostCount
      }
    }
  }

  await viewUser.save(updates, { patch: true })

  await GroupMembership.syncBadgeCounts(view.get('group_id'), [userId])

  // Return the GroupView; its newPostCount/lastReadPostId resolvers re-read the updated row.
  return GroupView.where({ id: viewId }).fetch()
}

export async function markViewAsRead (userId, viewId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!viewId) throw new GraphQLError('No viewId passed into function')

  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  await GroupViewUser.markRead(viewId, userId)
  await GroupMembership.syncBadgeCounts(view.get('group_id'), [userId])
  // Return GroupView so the frontend can refresh newPostCount/lastReadPostId in one round-trip.
  return GroupView.where({ id: viewId }).fetch()
}

/**
 * Mark every view in a group as read and clear the membership group-level badge.
 */
export async function markGroupAsRead (userId, groupId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')

  const group = await Group.find(groupId)
  if (!group) throw new GraphQLError('Group not found')

  const membership = await GroupMembership.forPair(userId, groupId).fetch()
  if (!membership) throw new GraphQLError('Not a member of this group')

  const views = await GroupView.findForGroup(groupId)
  for (const view of views.models) {
    await GroupViewUser.markRead(view.id, userId)
  }
  await GroupMembership.syncBadgeCounts(groupId, [userId])

  return group
}

export async function updateViewSettings (userId, viewId, settings) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!viewId) throw new GraphQLError('No viewId passed into function')

  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const viewUser = await GroupViewUser.findOrCreate(viewId, userId)
  return viewUser.save({ settings, updated_at: new Date() }, { patch: true })
}

export async function addPostToView (userId, viewId, postId, order) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const post = await Post.find(postId)
  if (!post) throw new GraphQLError('Post not found')

  const groupId = view.get('group_id')
  await requireAdminOrManageContent(userId, groupId, 'add posts to this view')

  const existing = await CollectionPost.find(viewId, postId)
  if (existing) return existing

  let nextOrder = order
  if (nextOrder == null) {
    const row = await bookshelf.knex('collections_posts')
      .where({ view_id: viewId })
      .select(bookshelf.knex.raw('coalesce(max("order"), -1) as max_order'))
      .first()
    nextOrder = Number(row.max_order) + 1
  }

  return CollectionPost.create({ view_id: viewId, post_id: postId, order: nextOrder, user_id: userId })
}

export async function removePostFromView (userId, viewId, postId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const groupId = view.get('group_id')
  await requireAdminOrManageContent(userId, groupId, 'remove posts from this view')

  const linkedPost = await CollectionPost.find(viewId, postId)
  if (!linkedPost) throw new GraphQLError('Not a valid post for this view')

  await linkedPost.destroy()

  return { success: true }
}

export async function reorderViewPost (userId, viewId, postId, newOrder) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  const groupId = view.get('group_id')
  await requireAdminOrManageContent(userId, groupId, 'reorder posts in this view')

  const linkedPost = await CollectionPost.find(viewId, postId)
  if (!linkedPost) throw new GraphQLError('Not a valid post for this view')

  const oldOrder = linkedPost.get('order')

  await bookshelf.transaction(async transacting => {
    if (oldOrder > newOrder) {
      await CollectionPost.query()
        .where({ view_id: viewId })
        .andWhere('order', '>=', newOrder)
        .andWhere('order', '<', oldOrder)
        .update({ order: bookshelf.knex.raw('?? + 1', ['order']) })
        .transacting(transacting)
    } else if (oldOrder < newOrder) {
      await CollectionPost.query()
        .where({ view_id: viewId })
        .andWhere('order', '<=', newOrder)
        .andWhere('order', '>', oldOrder)
        .update({ order: bookshelf.knex.raw('?? - 1', ['order']) })
        .transacting(transacting)
    }

    await linkedPost.save({ order: newOrder }, { transacting, patch: true })
  })

  return { success: true }
}

// Each turn is a paid model call
const DESIGN_TURNS_PER_GROUP_PER_HOUR = 60

/**
 * Counts one design turn for a group and reports whether it is within the
 * hourly limit. Fails open if Redis is unavailable.
 */
async function withinDesignTurnLimit (groupId) {
  try {
    const redis = RedisClient.create()
    const key = `ratelimit:designGroupView:group:${groupId}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, 60 * 60)
    return count <= DESIGN_TURNS_PER_GROUP_PER_HOUR
  } catch (err) {
    sails.log.error(`withinDesignTurnLimit failed: ${err.message}`)
    return true
  }
}

/**
 * One turn of the "Design your own view" chat. Saves nothing: returns the AI's
 * reply, the whole page as a designed view, and the token usage and estimated
 * cost. The steward saves the page with createGroupView or updateGroupView.
 * Requires the Administration responsibility and Hylo Pro.
 */
export async function designGroupViewTurn ({ userId, groupId, messages, currentView }, deps = {}) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')

  await requireAdmin(userId, groupId, 'design views')
  const group = await requireHyloProForDesignedViews(groupId)

  if (!(deps.isConfigured || isViewDesignConfigured)()) {
    throw new GraphQLError('Designing views with AI is not set up on this server')
  }

  let conversation
  try {
    conversation = normalizeDesignMessages(messages)
  } catch (err) {
    throw new GraphQLError(err.message)
  }

  // The current design comes from the browser, so only pass on what is valid
  let current = null
  if (currentView) {
    const { view, errors } = validateDesignedView(currentView)
    if (errors.length > 0) throw new GraphQLError(`Invalid design: ${errors.slice(0, 5).join('; ')}`)
    current = view
  }

  if (!(await (deps.withinLimit || withinDesignTurnLimit)(group.id))) {
    throw new GraphQLError('This group has used a lot of AI design in the last hour. Please try again later.')
  }

  try {
    return await (deps.designTurn || designViewTurnInChildProcess)({
      group: { name: group.get('name'), description: group.get('description') || group.get('purpose') || '' },
      messages: conversation,
      currentView: current
    })
  } catch (err) {
    sails.log.error(`designGroupViewTurn failed for group ${group.id}: ${err.message}`)
    throw new GraphQLError(`The design could not be made: ${err.message}`)
  }
}
