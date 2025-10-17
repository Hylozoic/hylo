import orm from 'store/models'
import { createSelector as ormCreateSelector } from 'redux-orm'
import { FULFILL_POST, UNFULFILL_POST, UNFULFILL_POST_PENDING, FULFILL_POST_PENDING, UPDATE_PROPOSAL_OUTCOME, SAVE_POST, UNSAVE_POST, SAVE_POST_PENDING, UNSAVE_POST_PENDING } from 'store/constants'

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
  (_, { routeParams }) => routeParams,
  (session, { groupSlug }) => session.Group.safeGet({ slug: groupSlug })
)

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
