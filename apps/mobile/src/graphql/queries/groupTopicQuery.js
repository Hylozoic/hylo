import { gql } from 'urql'

export default gql`
  query GroupTopicQuery($topicName: String, $groupSlug: String) {
    groupTopic(topicName: $topicName, groupSlug: $groupSlug) {
      id
      isSubscribed
      followersTotal
      postsTotal
      topic {
        id
        name
      }
      group {
        id
      }
    }
  }
`