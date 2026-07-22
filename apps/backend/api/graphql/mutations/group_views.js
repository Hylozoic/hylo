import { GraphQLError } from 'graphql'
import { notifyGroupUpdated } from './notifyGroupUpdated'

// Spaces & Views mutations — see docs/spaces-and-views-engineering-spec.md section 4.4

/** node-pg binds a JS array as a Postgres array type; in jsonb that becomes `{}` for []. */
function topicsForJsonb (topics) {
  return JSON.stringify(topics ?? [])
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

export async function createGroupView ({ userId, groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, viewUserId, context }) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!groupId) throw new GraphQLError('No groupId passed into function')
  if (!type) throw new GraphQLError('No type passed into function')

  await requireAdmin(userId, groupId, 'create views')

  const view = await GroupView.appendToMenu({
    group_id: groupId,
    type,
    name,
    icon,
    settings,
    link,
    page_content: pageContent,
    topics: topicsForJsonb(topics),
    linked_group_id: linkedGroupId,
    post_id: postId,
    user_id: viewUserId
  }).catch(err => {
    throw new GraphQLError(`Creation of view failed: ${err.message}`)
  })

  if (orderInFrontOfViewId) {
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
  await requireAdmin(userId, groupId, 'update views')

  const changes = {}
  if (name !== undefined) changes.name = name
  if (icon !== undefined) changes.icon = icon
  if (settings !== undefined) changes.settings = settings
  if (link !== undefined) changes.link = link
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
  if (['track-actions', 'funding-round-submissions'].includes(view.get('type'))) {
    throw new GraphQLError('This view cannot be deleted')
  }

  const wasWelcome = view.get('type') === GroupView.Type.WELCOME

  await view.destroy()
    .catch(err => {
      throw new GraphQLError(`Deletion of view failed: ${err.message}`)
    })

  // Welcome page is gone — stop redirecting new members to /welcome.
  if (wasWelcome) {
    const groupModel = await Group.find(groupId)
    if (groupModel) {
      const settings = groupModel.get('settings') || {}
      if (settings.show_welcome_page !== false) {
        await groupModel.save({
          settings: { ...settings, show_welcome_page: false }
        }, { patch: true })
      }
    }
  }

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
 * Hide or show a view in the group's menu.
 * Hidden views keep their content (order = null) and appear grayed in edit mode.
 * Showing appends the view to the end of the ordered menu.
 */
export async function setGroupViewHidden (userId, id, hidden, context) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!id) throw new GraphQLError('No view id passed into function')
  if (typeof hidden !== 'boolean') throw new GraphQLError('hidden must be a boolean')

  const view = await GroupView.where({ id }).fetch()
  if (!view) throw new GraphQLError('View not found')

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

  await GroupView.setHomeView({ id: viewId, groupId })
    .catch(err => {
      throw new GraphQLError(`Setting home view failed: ${err.message}`)
    })

  const group = await Group.find(groupId)
  notifyGroupUpdated(context, group, groupId)

  return { success: true }
}

/**
 * Update the current user's per-view unread state for a 'chat' type GroupView.
 * Sets lastReadPostId to the given post and recalculates newPostCount.
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
    updates.last_read_post_id = lastReadPostId
    const groupId = view.get('group_id')
    const newPostCount = await bookshelf.knex('posts')
      .join('groups_posts', 'posts.id', 'groups_posts.post_id')
      .where('groups_posts.group_id', groupId)
      .where('posts.type', 'chat')
      .where('posts.id', '>', lastReadPostId)
      .whereNull('posts.deactivated_at')
      .count('posts.id as count')
      .then(rows => parseInt(rows[0]?.count || 0))
    updates.new_post_count = newPostCount
  }

  await viewUser.save(updates, { patch: true })
  // Return the GroupView; its newPostCount/lastReadPostId resolvers re-read the updated row.
  return GroupView.where({ id: viewId }).fetch()
}

export async function markViewAsRead (userId, viewId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  if (!viewId) throw new GraphQLError('No viewId passed into function')

  const view = await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')

  return GroupViewUser.markRead(viewId, userId)
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
