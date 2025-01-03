import { gql } from 'urql'
import { FETCH_GROUP_STEWARDS } from 'store/constants'

export default function fetchGroupModerators ({ id, slug }) {
  return {
    type: FETCH_GROUP_STEWARDS,
    graphql: {
      query: gql`
        query GroupModeratorsQuery ($id: ID, $slug: String) {
          group (id: $id, slug: $slug) {
            id
            stewards {
              items {
                id
                name
                avatarUrl
              }
            }
          }
        }
      `,
      variables: {
        id,
        slug
      }
    },
    meta: {
      extractModel: 'Group',
      id,
      slug
    }
  }
}
