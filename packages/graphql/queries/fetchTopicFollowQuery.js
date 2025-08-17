import { gql } from 'urql'

export default gql`
  query FetchTopicFollowQuery($groupId: ID, $topicName: String) {
    topicFollow(groupId: $groupId, topicName: $topicName) {
      id
      lastReadPostId
      newPostCount
      settings {
        notifications
      }
      group {
        id
      }
      topic {
        id
        name
      }
    }
  }
`
