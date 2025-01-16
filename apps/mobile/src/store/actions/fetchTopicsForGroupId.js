import { FETCH_TOPICS_FOR_GROUP_ID } from 'store/constants'
import topicsForGroupIdQuery from 'graphql/queries/topicsForGroupIdQuery'

// TODO make this work for all groups & multiple specific groups
export default function fetchTopicsForGroupId (groupId) {
  return function (searchTerm) {
    return {
      type: FETCH_TOPICS_FOR_GROUP_ID,
      graphql: {
        query: topicsForGroupIdQuery,
        variables: {
          searchTerm,
          groupId
        }
      },
      meta: {
        extractModel: {
          getRoot: results =>
            results.group.groupTopics.items.map(item => item.topic),
          modelName: 'Topic',
          append: true
        }
      }
    }
  }
}
