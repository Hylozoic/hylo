import { RESET_NEW_POST_COUNT } from 'store/constants'

export default function resetNewPostCount (id, type, count = 0) {
  if (!['TopicFollow', 'Membership'].includes(type)) {
    throw new Error(`bad type for resetNewPostCount: ${type}`)
  }

  return {
    type: RESET_NEW_POST_COUNT,
    graphql: {
      query: type === 'TopicFollow' ? TopicFollowQuery : MembershipQuery,
      variables: {
        id,
        data: {
          newPostCount: count
        }
      }
    },
    meta: { id, type, count, optimistic: true }
  }
}

const TopicFollowQuery = `mutation($id: ID, $data: TopicFollowInput) {
    updateTopicFollow(id: $id, data: $data) {
      id
      newPostCount
      group {
        id
      }
      topic {
        id
      }
    }
  }`

const MembershipQuery = `mutation($id: ID, $data: MembershipInput) {
    updateMembership(groupId: $id, data: $data) {
      id
    }
  }`
