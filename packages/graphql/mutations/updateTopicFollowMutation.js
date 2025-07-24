import { gql } from 'urql'
import topicFollowFieldsFragment from '../fragments/topicFollowFieldsFragment'

export default gql`
  mutation UpdateTopicFollowMutation($id: ID, $data: TopicFollowInput) {
    updateTopicFollow(id: $id, data: $data) {
      ...TopicFollowFieldsFragment
    }
  }
  ${topicFollowFieldsFragment}
` 