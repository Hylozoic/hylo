import { gql } from 'urql'
import topicFollowFieldsFragment from '../fragments/topicFollowFieldsFragment'

export default gql`
  query TopicFollowQuery($groupId: ID, $topicName: String) {
    topicFollow(groupId: $groupId, topicName: $topicName) {
      ...TopicFollowFieldsFragment
    }
  }
  ${topicFollowFieldsFragment}
` 