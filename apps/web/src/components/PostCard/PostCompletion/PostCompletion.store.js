export const FETCH_HELPER_CANDIDATES = 'PostCompletion/FETCH_HELPER_CANDIDATES'
export const ADD_REQUEST_HELPERS = 'PostCompletion/ADD_REQUEST_HELPERS'

const MAX_HELPER_CANDIDATES = 100

// The people who commented on a request: the ones 'Who helped?' offers (D27)
export function fetchHelperCandidates (postId) {
  return {
    type: FETCH_HELPER_CANDIDATES,
    graphql: {
      query: `query PostHelperCandidates ($id: ID, $first: Int) {
        post (id: $id) {
          id
          commenters (first: $first) {
            id
            name
            avatarUrl
          }
        }
      }`,
      variables: { id: postId, first: MAX_HELPER_CANDIDATES }
    }
  }
}

// Names who helped on a request that is already marked met; the server tells them
export function addRequestHelpers (postId, contributorIds) {
  return {
    type: ADD_REQUEST_HELPERS,
    graphql: {
      query: `mutation AddRequestHelpers ($postId: ID, $contributorIds: [ID]) {
        fulfillPost (postId: $postId, contributorIds: $contributorIds) {
          success
        }
      }`,
      variables: { postId, contributorIds }
    },
    meta: { postId }
  }
}
