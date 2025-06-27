import { get } from 'lodash/fp'
import gql from 'graphql-tag'
import { FIND_TOPICS } from 'store/constants'

export default function findTopics ({ autocomplete, maxItems = 7, groupIds, groupSlug, includeCounts = false }) {
  return {
    type: FIND_TOPICS,
    graphql: {
      query: gql`
        query FindTopicsQuery ($autocomplete: String, $maxItems: Int, $groupSlug: String, $groupIds: [ID]) {
          topics(autocomplete: $autocomplete, first: $maxItems, groupSlug: $groupSlug, groupIds: $groupIds) {
            items {
              id
              name
              ${includeCounts
                ? `
                followersTotal(
                  groupSlug: $groupSlug
                )
                postsTotal(
                  groupSlug: $groupSlug
                )`
                : ''}
            }
          }
        }
      `,
      variables: {
        autocomplete,
        maxItems,
        groupIds,
        groupSlug
      }
    },
    meta: {
      extractModel: {
        getRoot: get('topics'),
        modelName: 'Topic',
        append: true
      }
    }
  }
}
