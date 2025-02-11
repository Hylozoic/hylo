import { get } from 'lodash/fp'
import { UPDATE_TOPIC_FOLLOW } from 'store/constants'

export default function updateTopicFollow (id, data) {
  return {
    type: UPDATE_TOPIC_FOLLOW,
    graphql: {
      query: `mutation($id: ID, $data: TopicFollowInput) {
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
      }`,
      variables: {
        id,
        data
      }
    },
    meta: {
      id,
      data,
      optimistic: true,
      extractModel: [
        {
          getRoot: get('updateTopicFollow'),
          modelName: 'TopicFollow'
        }
      ]
    }
  }
}
