/* global bookshelf, CollectionPost, Group, GroupView, Responsibility, TrackModule */
import { GraphQLError } from 'graphql'

/**
 * Loads a track-actions view and checks that the user may edit its outline:
 * Administration or Manage Content on the track space, or Administration on
 * the space's parent group (stewards editing from the parent's menu).
 */
async function loadEditableView (userId, viewId) {
  if (!userId) throw new GraphQLError('No userId passed into function')
  const view = viewId && await GroupView.where({ id: viewId }).fetch()
  if (!view) throw new GraphQLError('View not found')
  if (view.get('type') !== GroupView.Type.TRACK_ACTIONS) {
    throw new GraphQLError('Modules can only be added to a track')
  }

  const { RESP_ADMINISTRATION, RESP_MANAGE_CONTENT } = Responsibility.constants
  const groupId = view.get('group_id')
  const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)
  if (responsibilities.includes(RESP_ADMINISTRATION) || responsibilities.includes(RESP_MANAGE_CONTENT)) return view

  const space = await Group.find(groupId)
  const parentId = space && space.get('parent_id')
  if (parentId) {
    const parentResponsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, parentId)
    if (parentResponsibilities.includes(RESP_ADMINISTRATION)) return view
  }

  throw new GraphQLError("You don't have permission to edit this track")
}

/** Turns TrackModuleInput into column values, merging opening rules into the existing settings. */
function moduleAttrs (data = {}, existingSettings = {}) {
  const attrs = {}
  if (data.title !== undefined) attrs.title = (data.title || '').slice(0, 255)
  if (data.description !== undefined) attrs.description = data.description

  const settings = { ...existingSettings }
  if (data.opensAt !== undefined) {
    if (data.opensAt) {
      const opensAt = new Date(data.opensAt)
      if (isNaN(opensAt.getTime())) throw new GraphQLError('Invalid opening date')
      settings.opens_at = opensAt.toISOString()
    } else {
      delete settings.opens_at
    }
  }
  if (data.opensAfterPrevious !== undefined) {
    settings.opens_after_previous = !!data.opensAfterPrevious
  }
  attrs.settings = settings
  return attrs
}

/** Adds an empty module at the end of a track's outline. */
export async function createTrackModule (userId, viewId, data) {
  const view = await loadEditableView(userId, viewId)
  return bookshelf.transaction(async transacting => {
    const order = await TrackModule.nextOrderForView(view.id, { transacting })
    return TrackModule.create({
      ...moduleAttrs(data),
      view_id: view.id,
      order
    }, { transacting })
  })
}

export async function updateTrackModule (userId, moduleId, data) {
  const trackModule = await TrackModule.find(moduleId)
  if (!trackModule) throw new GraphQLError('Module not found')
  await loadEditableView(userId, trackModule.get('view_id'))
  await trackModule.save(moduleAttrs(data, trackModule.get('settings') || {}), { patch: true })
  return trackModule
}

/**
 * Removes a module and keeps its actions: they become top-level actions and,
 * because their order numbers don't change, stay where the module was.
 */
export async function deleteTrackModule (userId, moduleId) {
  const trackModule = await TrackModule.find(moduleId)
  if (!trackModule) throw new GraphQLError('Module not found')
  await loadEditableView(userId, trackModule.get('view_id'))

  await bookshelf.transaction(async transacting => {
    await CollectionPost.query()
      .where({ module_id: trackModule.id })
      .update({ module_id: null })
      .transacting(transacting)
    await trackModule.destroy({ transacting })
  })

  return { success: true }
}

/**
 * Saves a track's whole outline after a drag: the order of the top-level items,
 * and which actions sit in which module.
 *
 * `items` is the top-level list. Each item is either { postId } for an action
 * outside any module, or { moduleId, postIds } for a module and the actions in
 * it. Actions and modules the caller left out (ones they can't see, or ones
 * added by someone else in the meantime) keep their module and go to the end.
 */
export async function updateTrackOutline (userId, viewId, items) {
  const view = await loadEditableView(userId, viewId)

  const rows = (await view.collectionPosts().fetch()).models
  const modules = (await view.trackModules().fetch()).models
  const rowsByPostId = new Map(rows.map(row => [String(row.get('post_id')), row]))
  const modulesById = new Map(modules.map(m => [String(m.id), m]))

  const seenPosts = new Set()
  const seenModules = new Set()
  const takePost = postId => {
    const key = String(postId)
    if (!rowsByPostId.has(key)) throw new GraphQLError('Not a valid post for this track')
    if (seenPosts.has(key)) throw new GraphQLError('A post can only be in the outline once')
    seenPosts.add(key)
    return rowsByPostId.get(key)
  }

  // One shared number sequence: a module takes a number, then its actions do
  const moduleOrders = []
  const postOrders = []
  let next = 0
  for (const item of items || []) {
    if (item.moduleId != null) {
      const key = String(item.moduleId)
      if (!modulesById.has(key)) throw new GraphQLError('Not a valid module for this track')
      if (seenModules.has(key)) throw new GraphQLError('A module can only be in the outline once')
      seenModules.add(key)
      moduleOrders.push({ id: modulesById.get(key).id, order: next++ })
      for (const postId of item.postIds || []) {
        postOrders.push({ id: takePost(postId).id, order: next++, moduleId: modulesById.get(key).id })
      }
    } else if (item.postId != null) {
      postOrders.push({ id: takePost(item.postId).id, order: next++, moduleId: null })
    } else {
      throw new GraphQLError('Each outline item needs a postId or a moduleId')
    }
  }
  for (const m of modules) {
    if (!seenModules.has(String(m.id))) moduleOrders.push({ id: m.id, order: next++ })
  }
  for (const row of rows) {
    if (!seenPosts.has(String(row.get('post_id')))) {
      postOrders.push({ id: row.id, order: next++, moduleId: row.get('module_id') })
    }
  }

  await bookshelf.transaction(async transacting => {
    for (const { id, order } of moduleOrders) {
      await bookshelf.knex('track_modules').transacting(transacting).where({ id }).update({ order, updated_at: new Date() })
    }
    for (const { id, order, moduleId } of postOrders) {
      await bookshelf.knex('collections_posts').transacting(transacting).where({ id }).update({ order, module_id: moduleId, updated_at: new Date() })
    }
  })

  return view
}
