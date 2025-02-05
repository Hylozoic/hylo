import gql from 'graphql-tag'
import { FIND_MENTIONS } from 'store/constants'

export default function findMentions ({ autocomplete, groupIds, maxItems = 5, offset = 0 }) {
  return {
    type: FIND_MENTIONS,
    graphql: {
      query: gql`
        query FindPeopleForMentions ($autocomplete: String, $groupIds: [ID], $maxItems: Int, $offset: Int) {
          people(autocomplete: $autocomplete, first: $maxItems, offset: $offset, groupIds: $groupIds) {
            items {
              id
              name
              avatarUrl
            }
            total
            hasMore
          }
        }
      `,
      variables: {
        autocomplete,
        groupIds,
        maxItems,
        offset
      }
    },
    meta: { extractModel: 'Person' }
  }
}
