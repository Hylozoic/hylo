import { FETCH_COMMENTS } from 'store/constants'
import { get } from 'lodash/fp'
import commentsQuery from 'graphql/queries/commentsQuery'
import subCommentsQuery from 'graphql/queries/subCommentsQuery'

export default function fetchComments ({ commentId, postId }, opts = {}) {
  if (commentId) return fetchChildComments(commentId, opts)
  if (postId) return fetchPostComments(postId, opts)
}

export function fetchChildComments (commentId, opts = {}) {
  const { cursor } = opts

  return {
    type: FETCH_COMMENTS,
    graphql: {
      query: subCommentsQuery,
      variables: {
        commentId,
        cursor: cursor || null
      }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'Comment',
      extractQueryResults: {
        getItems: get('payload.data.comment.childComments')
      }
    }
  }
}

export function fetchPostComments (postId, opts = {}) {
  const { cursor } = opts

  return {
    type: FETCH_COMMENTS,
    graphql: {
      query: commentsQuery,
      variables: {
        postId,
        cursor: cursor || null
      }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'Post',
      extractQueryResults: {
        getItems: get('payload.data.post.comments'),
        extractSubComments: true
      }
    }
  }
}
