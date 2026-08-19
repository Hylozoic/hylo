import { PIN_POST } from 'store/constants'

/**
 * Toggles a post's pinned state within one group (server toggles
 * groups_posts.pinned_at; RESP_MANAGE_CONTENT is required).
 */
export default function pinPost (postId, groupId) {
  return {
    type: PIN_POST,
    graphql: {
      query: `mutation PinPost ($postId: ID, $groupId: ID) {
        pinPost(postId: $postId, groupId: $groupId) {
          success
        }
      }`,
      variables: { postId, groupId }
    },
    meta: {
      postId,
      groupId,
      optimistic: true
    }
  }
}
