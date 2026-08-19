import { PIN_POST } from 'store/constants'

/**
 * Toggles a post's pinned state on one view (server toggles group_view_pins;
 * RESP_MANAGE_CONTENT is required).
 */
export default function pinPost (postId, viewId, groupId, post) {
  return {
    type: PIN_POST,
    graphql: {
      query: `mutation PinPost ($postId: ID, $viewId: ID) {
        pinPost(postId: $postId, viewId: $viewId) {
          success
        }
      }`,
      variables: { postId, viewId }
    },
    meta: {
      postId,
      viewId,
      groupId,
      post,
      optimistic: true
    }
  }
}
