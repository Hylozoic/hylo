import { get } from 'lodash/fp'
import gql from 'graphql-tag'
import { FIND_TOPICS } from 'store/constants'

export default function findTopics ({ autocomplete, maxItems = 7, groupId, groupSlug }) {
  return {
    type: FIND_TOPICS,
    graphql: {
      query: gql`
        query FindTopicsQuery ($autocomplete: String, $maxItems: Int, $groupId: ID, $groupSlug: String) {
          groupTopics(autocomplete: $autocomplete, first: $maxItems, groupId: $groupId) {
            items {
              topic {
                id
                name
                followersTotal(
                  groupSlug: $groupSlug
                )
                postsTotal(
                  groupSlug: $groupSlug
                )
              }
            }
          }
        }
      `,
      variables: {
        autocomplete,
        maxItems,
        groupId,
        groupSlug
      }
    },
    meta: {
      extractModel: {
        getRoot: collectTopics,
        modelName: 'Topic',
        append: true
      }
    }
  }
}

const collectTopics = results => results.groupTopics.items.map(get('topic'))
