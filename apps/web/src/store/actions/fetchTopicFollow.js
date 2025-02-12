import { FETCH_TOPIC_FOLLOW } from 'store/constants'

export default function fetchTopicFollow (groupId, topicName) {
  return {
    type: FETCH_TOPIC_FOLLOW,
    graphql: {
      query: `query ($groupId: ID, $topicName: String) {
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
      }`,
      variables: {
        groupId,
        topicName
      }
    },
    meta: {
      extractModel: 'TopicFollow'
    }
  }
}
