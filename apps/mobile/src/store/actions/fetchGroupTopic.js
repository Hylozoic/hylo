import gql from 'graphql-tag'
import { FETCH_GROUP_TOPIC } from 'store/constants'

export default function fetchGroupTopic (topicName, groupSlug) {
  return {
    type: FETCH_GROUP_TOPIC,
    graphql: {
      query: gql`
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
      `,
      variables: { topicName, groupSlug }
    },
    meta: {
      afterInteractions: true,
      extractModel: 'GroupTopic'
    }
  }
}
