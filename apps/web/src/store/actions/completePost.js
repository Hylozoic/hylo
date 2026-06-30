import { COMPLETE_POST } from 'store/constants'

export default function completePost (id, completionResponse, { trackId, trackCompleted, completionRoleId, completionRole, groupId } = {}) {
  return {
    type: COMPLETE_POST,
    graphql: {
      query: `mutation CompletePost ($postId: ID, $completionResponse: JSON) {
        completePost(postId: $postId, completionResponse: $completionResponse) {
          id
          completedAt
          completionResponse
        }
      }`,
      variables: {
        postId: id,
        completionResponse: JSON.stringify(completionResponse)
      }
    },
    meta: {
      optimistic: true,
      postId: id,
      completionResponse,
      trackId,
      trackCompleted,
      completionRoleId,
      completionRole,
      groupId
    }
  }
}
