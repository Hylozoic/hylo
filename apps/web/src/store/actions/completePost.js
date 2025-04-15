import { COMPLETE_POST } from 'store/constants'

export default function completePost (id, completionResponse) {
  return {
    type: COMPLETE_POST,
    graphql: {
      query: `mutation CompletePost ($postId: ID, $completionResponse: JSON) {
        completePost(postId: $postId, completionResponse: $completionResponse) {
          success
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
      completionResponse
    }
  }
}
