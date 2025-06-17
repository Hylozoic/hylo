import { get } from 'lodash/fp'
import gql from 'graphql-tag'
import { FIND_TOPICS } from 'store/constants'

export default function findTopics ({ autocomplete, maxItems = 7, groupId, groupsIds, groupSlug }) {
  return {
    type: FIND_TOPICS,
    graphql: {
      query: gql`
        query FindTopicsQuery ($autocomplete: String, $maxItems: Int, $groupSlug: String) {
          topics(autocomplete: $autocomplete, first: $maxItems, groupSlug: $groupSlug) {
            items {
              id
              name
              # followersTotal(
              #   groupSlug: $groupSlug
              # )
              # postsTotal(
              #   groupSlug: $groupSlug
              # )
            }
          }
        }
      `,
      variables: {
        autocomplete,
        maxItems,
        groupId,
        groupsIds,
        groupSlug
      }
    },
    meta: {
      extractModel: {
        modelName: 'Topic',
        append: true
      }
    }
  }
}

