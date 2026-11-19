import {
  ADD_POST_TO_VIEW_PENDING,
  COMPLETE_POST_PENDING,
  CREATE_COMMENT_PENDING,
  CREATE_POST,
  CREATE_TRACK_MODULE,
  DELETE_POST_PENDING,
  DELETE_TRACK_MODULE_PENDING,
  REACT_ON_POST_PENDING,
  REMOVE_POST_FROM_VIEW_PENDING,
  REORDER_VIEW_POST_PENDING,
  UPDATE_TRACK_MODULE_PENDING,
  UPDATE_TRACK_OUTLINE_PENDING
} from 'store/constants'
import { applyOutlineInput, buildOutline, outlineToViewFields } from './trackOutline'
import { updateGroupViewInMenu } from 'store/util/groupViewsOrder'

function normalizeGroupIds (groupIds) {
  if (!groupIds) return []
  return (Array.isArray(groupIds) ? groupIds : [groupIds]).filter(Boolean).map(String)
}

/** Patch completion fields on a post in track-actions collectionPosts for the given groups. */
export function updateTrackActionCompletionInMenus ({ Group, postId, completedAt, completionResponse, groupIds }) {
  if (!postId) return

  let updated = false
  const patchGroup = (group) => {
    if (!group || updated) return
    const actionsView = group.groupViews?.items?.find(view => view.type === 'track-actions')
    if (!actionsView?.collectionPosts) return
    if (!actionsView.collectionPosts.some(post => String(post.id) === String(postId))) return

    updateGroupViewInMenu(group, actionsView.id, {
      collectionPosts: actionsView.collectionPosts.map(post =>
        String(post.id) === String(postId)
          ? { ...post, completedAt, completionResponse }
          : post
      )
    })
    updated = true
  }

  normalizeGroupIds(groupIds).forEach(groupId => patchGroup(Group.withId(groupId)))

  if (!updated) {
    Group.all().toModelArray().forEach(patchGroup)
  }
}

/** Finds a view's raw collectionPosts array within a group's embedded menu (top-level or nested space menu). */
function findCollectionPosts (group, viewId) {
  const items = group?.groupViews?.items || []
  const view = items.find(v => String(v.id) === String(viewId))
  if (view) return view.collectionPosts

  for (const view of items) {
    const nested = (view.linkedGroup?.groupViews?.items || []).find(v => String(v.id) === String(viewId))
    if (nested) return nested.collectionPosts
  }
  return undefined
}

/** Finds a view's raw row within a group's embedded menu (top-level or nested space menu). */
function findView (group, viewId) {
  const items = group?.groupViews?.items || []
  const view = items.find(v => String(v.id) === String(viewId))
  if (view) return view

  for (const item of items) {
    const nested = (item.linkedGroup?.groupViews?.items || []).find(v => String(v.id) === String(viewId))
    if (nested) return nested
  }
  return undefined
}

/**
 * Rewrites a track's outline in place: builds the top-level items from the
 * view's stored posts and modules, runs `change` on them, and stores the result.
 * Returns false when the view has no modules, so the caller can fall back to
 * the plain collectionPosts update.
 */
function rewriteOutline (group, viewId, change) {
  const view = findView(group, viewId)
  if (!view?.collectionPosts || !view.trackModules?.length) return false
  updateGroupViewInMenu(group, viewId, outlineToViewFields(change(buildOutline(view.collectionPosts, view.trackModules))))
  return true
}

/** Takes a post out of an outline, wherever it sits. */
const withoutPost = postId => items => items
  .filter(item => !(item.kind === 'action' && item.id === String(postId)))
  .map(item => item.kind === 'module'
    ? { ...item, posts: item.posts.filter(post => String(post.id) !== String(postId)) }
    : item)

/**
 * Optimistically updates a view's raw collectionPosts (a plain attribute, not
 * a normalized Post relation — see fetchViewPosts) for reordering and removal.
 */
export function ormSessionReducer ({ Group, Post }, { type, meta, payload }) {
  switch (type) {
    case CREATE_COMMENT_PENDING: {
      const post = Post.withId(meta.postId)
      if (post?.completionAction !== 'comment') break
      updateTrackActionCompletionInMenus({
        Group,
        postId: meta.postId,
        completedAt: new Date().toISOString(),
        completionResponse: [meta.text],
        groupIds: meta.analytics?.groupId
      })
      break
    }

    case REACT_ON_POST_PENDING: {
      const post = Post.withId(meta.postId)
      if (post?.completionAction !== 'reaction') break
      updateTrackActionCompletionInMenus({
        Group,
        postId: meta.postId,
        completedAt: post.completedAt || new Date().toISOString(),
        completionResponse: post.completionResponse || [meta.data?.emojiFull],
        groupIds: meta.analytics?.groupId
      })
      break
    }

    case CREATE_POST: {
      const { groupIds, viewId, moduleId } = meta
      const createdPost = payload?.data?.createPost
      if (!viewId || !createdPost) return

      const groupId = Array.isArray(groupIds) ? groupIds[0] : groupIds
      const group = Group.safeWithId(groupId)
      const posts = findCollectionPosts(group, viewId)
      // Only append when this view's posts have already been loaded; otherwise
      // the next fetchViewPosts will bring the new post in.
      if (!posts) return
      if (posts.some(p => String(p.id) === String(createdPost.id))) return

      // An action added from inside a module goes to the end of that module
      const trackModules = findView(group, viewId)?.trackModules
      updateGroupViewInMenu(group, viewId, {
        collectionPosts: [...posts, createdPost],
        trackModules: moduleId && trackModules
          ? trackModules.map(m => String(m.id) === String(moduleId)
            ? { ...m, postIds: [...(m.postIds || []), createdPost.id] }
            : m)
          : trackModules
      })
      break
    }

    case UPDATE_TRACK_OUTLINE_PENDING: {
      const { groupId, viewId, items } = meta
      const group = Group.safeWithId(groupId)
      const view = findView(group, viewId)
      if (!view?.collectionPosts) return
      updateGroupViewInMenu(group, viewId, applyOutlineInput(view.collectionPosts, view.trackModules, items))
      break
    }

    case CREATE_TRACK_MODULE: {
      const { groupId, viewId } = meta
      const created = payload?.data?.createTrackModule
      const group = Group.safeWithId(groupId)
      const view = findView(group, viewId)
      if (!created || !view) return
      const trackModules = view.trackModules || []
      if (trackModules.some(m => String(m.id) === String(created.id))) return
      // A new module goes last in the top-level outline
      const index = buildOutline(view.collectionPosts, trackModules).length
      updateGroupViewInMenu(group, viewId, {
        trackModules: [...trackModules, { ...created, index, postIds: created.postIds || [] }]
      })
      break
    }

    case UPDATE_TRACK_MODULE_PENDING: {
      const { groupId, viewId, moduleId, data } = meta
      const group = Group.safeWithId(groupId)
      const view = findView(group, viewId)
      if (!view?.trackModules) return
      updateGroupViewInMenu(group, viewId, {
        trackModules: view.trackModules.map(m => String(m.id) === String(moduleId) ? { ...m, ...data } : m)
      })
      break
    }

    case DELETE_TRACK_MODULE_PENDING: {
      const { groupId, viewId, moduleId } = meta
      const group = Group.safeWithId(groupId)
      // The module's actions stay, at the top level where the module was
      rewriteOutline(group, viewId, items => items.flatMap(item =>
        item.kind === 'module' && item.id === String(moduleId)
          ? item.posts.map(post => ({ kind: 'action', id: String(post.id), post }))
          : [item]))
      break
    }

    case REORDER_VIEW_POST_PENDING: {
      const { groupId, viewId, postId, order } = meta
      const group = Group.safeWithId(groupId)
      const posts = findCollectionPosts(group, viewId)
      if (!posts) return

      const fromIndex = posts.findIndex(p => String(p.id) === String(postId))
      if (fromIndex === -1) return

      const reordered = [...posts]
      const [moved] = reordered.splice(fromIndex, 1)
      reordered.splice(order, 0, moved)
      updateGroupViewInMenu(group, viewId, { collectionPosts: reordered })
      break
    }

    case ADD_POST_TO_VIEW_PENDING: {
      const { groupId, viewId, postId, post } = meta
      if (!post) return
      const group = Group.safeWithId(groupId)
      if (!group) return
      const posts = findCollectionPosts(group, viewId)
      if (posts === undefined) {
        updateGroupViewInMenu(group, viewId, { collectionPosts: [post] })
        return
      }
      if (posts.some(p => String(p.id) === String(postId))) return
      updateGroupViewInMenu(group, viewId, {
        collectionPosts: [...posts, post]
      })
      break
    }

    case REMOVE_POST_FROM_VIEW_PENDING: {
      const { groupId, viewId, postId } = meta
      const group = Group.safeWithId(groupId)
      const posts = findCollectionPosts(group, viewId)
      if (!posts) return
      if (rewriteOutline(group, viewId, withoutPost(postId))) break
      updateGroupViewInMenu(group, viewId, {
        collectionPosts: posts.filter(p => String(p.id) !== String(postId))
      })
      break
    }

    case DELETE_POST_PENDING: {
      const { groupId, viewId, id: postId } = meta
      if (!viewId) return
      const group = Group.safeWithId(groupId)
      const posts = findCollectionPosts(group, viewId)
      if (!posts) return
      if (rewriteOutline(group, viewId, withoutPost(postId))) break

      updateGroupViewInMenu(group, viewId, {
        collectionPosts: posts.filter(p => String(p.id) !== String(postId))
      })
      break
    }

    case COMPLETE_POST_PENDING: {
      const { postId, completionResponse } = meta
      if (!postId) return

      const groups = Group.all().toModelArray()
      for (const group of groups) {
        const items = group.groupViews?.items || []
        for (const view of items) {
          if (view.type !== 'track-actions' || !Array.isArray(view.collectionPosts)) continue
          const index = view.collectionPosts.findIndex(p => String(p.id) === String(postId))
          if (index === -1) continue
          const posts = [...view.collectionPosts]
          posts[index] = {
            ...posts[index],
            completedAt: new Date().toISOString(),
            completionResponse
          }
          updateGroupViewInMenu(group, view.id, { collectionPosts: posts })
        }
      }
      break
    }
  }
}
