import { gql } from 'urql'

export default gql`
  mutation UpdateTopicFollowMutation($id: ID, $data: TopicFollowInput) {
    updateTopicFollow(id: $id, data: $data) {
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
