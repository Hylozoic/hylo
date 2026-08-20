import {
  ADD_POST_TO_VIEW_PENDING,
  CREATE_COMMENT_PENDING,
  CREATE_POST,
  DELETE_POST_PENDING,
  REACT_ON_POST_PENDING,
  REMOVE_POST_FROM_VIEW_PENDING,
  REORDER_VIEW_POST_PENDING
} from 'store/constants'
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
      const { groupIds, viewId } = meta
      const createdPost = payload?.data?.createPost
      if (!viewId || !createdPost) return

      const groupId = Array.isArray(groupIds) ? groupIds[0] : groupIds
      const group = Group.safeWithId(groupId)
      const posts = findCollectionPosts(group, viewId)
      // Only append when this view's posts have already been loaded; otherwise
      // the next fetchViewPosts will bring the new post in.
      if (!posts) return
      if (posts.some(p => String(p.id) === String(createdPost.id))) return

      updateGroupViewInMenu(group, viewId, {
        collectionPosts: [...posts, createdPost]
      })
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

      updateGroupViewInMenu(group, viewId, {
        collectionPosts: posts.filter(p => String(p.id) !== String(postId))
      })
      break
    }
  }
}
