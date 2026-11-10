import orm from 'store/models'
import { updateGroupViewInAllMenus } from 'store/util/groupViewsOrder'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { FULFILL_POST, UNFULFILL_POST, UNFULFILL_POST_PENDING, FULFILL_POST_PENDING, UPDATE_PROPOSAL_OUTCOME, SAVE_POST, UNSAVE_POST, SAVE_POST_PENDING, UNSAVE_POST_PENDING, FOLLOW_POST, UNFOLLOW_POST, FOLLOW_POST_PENDING, UNFOLLOW_POST_PENDING } from 'store/constants'

export const MODULE_NAME = 'PostHeader'

export function fulfillPost (postId) {
  return {
    type: FULFILL_POST,
    graphql: {
      query: `mutation ($postId: ID) {
        fulfillPost (postId: $postId) {
          success
        }
      }`,
      variables: {
        postId
      }
    },
    meta: {
      optimistic: true,
      postId
    }
  }
}

export function unfulfillPost (postId) {
  return {
    type: UNFULFILL_POST,
    graphql: {
      query: `mutation ($postId: ID) {
        unfulfillPost (postId: $postId) {
          success
        }
      }`,
      variables: {
        postId
      }
    },
    meta: {
      optimistic: true,
      postId
    }
  }
}

export function updateProposalOutcome (postId, proposalOutcome) {
  return {
    type: UPDATE_PROPOSAL_OUTCOME,
    graphql: {
      query: `mutation ($postId: ID, $proposalOutcome: String) {
        updateProposalOutcome (postId: $postId, proposalOutcome: $proposalOutcome) {
          success
        }
      }`,
      variables: {
        postId,
        proposalOutcome
      }
    },
    meta: {
      optimistic: true,
      postId,
      proposalOutcome
    }
  }
}

export function savePost (postId) {
  return {
    type: SAVE_POST,
    graphql: {
      query: `mutation ($postId: ID) {
        savePost (postId: $postId) {
          id
          savedAt
        }
      }`,
      variables: {
        postId
      }
    },
    meta: {
      optimistic: true,
      postId,
      extractModel: 'Post'
    }
  }
}

export function unsavePost (postId) {
  return {
    type: UNSAVE_POST,
    graphql: {
      query: `mutation ($postId: ID) {
        unsavePost (postId: $postId) {
          id
          savedAt
        }
      }`,
      variables: {
        postId
      }
    },
    meta: {
      optimistic: true,
      postId,
      extractModel: 'Post'
    }
  }
}

export const getGroup = ormCreateSelector(
  orm,
  (_, props) => props.groupSlug || props.routeParams?.groupSlug,
  (session, slug) => slug ? session.Group.safeGet({ slug }) : null
)

/** Writes follow state onto the post and pinned copies stored on group menus. */
function applyFollowing ({ Post, Group }, postId, isFollowing) {
  if (postId == null) return
  if (Post.idExists(postId)) {
    Post.withId(postId).update({ isFollowing })
  }
  const patches = []
  Group.all().toModelArray().forEach(group => {
    const items = group.groupViews?.items || []
    items.forEach(view => {
      const pinned = view.pinnedPosts
      if (!Array.isArray(pinned) || !pinned.some(post => String(post.id) === String(postId))) return
      patches.push({
        viewId: view.id,
        pinnedPosts: pinned.map(post => String(post.id) === String(postId) ? { ...post, isFollowing } : post)
      })
    })
  })
  patches.forEach(patch => updateGroupViewInAllMenus(Group.all(), patch.viewId, { pinnedPosts: patch.pinnedPosts }))
}

export function ormSessionReducer ({ Group, Post }, { type, meta }) {
  let post
  switch (type) {
    case FULFILL_POST_PENDING:
      post = Post.withId(meta.postId)
      post.update({ fulfilledAt: (new Date()).toISOString() })
      break

    case UNFULFILL_POST_PENDING:
      post = Post.withId(meta.postId)
      post.update({ fulfilledAt: null })
      break

    case FOLLOW_POST_PENDING:
    case FOLLOW_POST:
      applyFollowing({ Post, Group }, meta.postId, true)
      break

    case UNFOLLOW_POST_PENDING:
    case UNFOLLOW_POST:
      applyFollowing({ Post, Group }, meta.postId, false)
      break

    case SAVE_POST_PENDING:
      post = Post.withId(meta.postId)
      post.update({ savedAt: (new Date()).toISOString() })
      break

    case UNSAVE_POST_PENDING:
      post = Post.withId(meta.postId)
      post.update({ savedAt: null })
      break
  }
}
