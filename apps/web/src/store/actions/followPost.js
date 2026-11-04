import { FOLLOW_POST, UNFOLLOW_POST } from 'store/constants'

export function followPost (postId) {
  return {
    type: FOLLOW_POST,
    graphql: {
      query: `mutation FollowPost ($postId: ID) {
        followPost (postId: $postId) {
          id
          isFollowing
        }
      }`,
      variables: { postId }
    },
    meta: {
      postId,
      extractModel: 'Post'
    }
  }
}

export function unfollowPost (postId) {
  return {
    type: UNFOLLOW_POST,
    graphql: {
      query: `mutation UnfollowPost ($postId: ID) {
        unfollowPost (postId: $postId) {
          id
          isFollowing
        }
      }`,
      variables: { postId }
    },
    meta: {
      postId,
      extractModel: 'Post'
    }
  }
}
