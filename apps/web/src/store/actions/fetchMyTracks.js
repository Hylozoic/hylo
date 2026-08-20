import { get } from 'lodash/fp'

export const FETCH_MY_TRACKS = 'FETCH_MY_TRACKS'

const query = `
query FetchMyTracks (
  $autocomplete: String,
  $first: Int,
  $offset: Int,
  $order: String,
  $sortBy: String
) {
  me {
    id
    tracksEnrolledIn (autocomplete: $autocomplete, first: $first, offset: $offset, sortBy: $sortBy, order: $order) {
      items {
        id
        accessControlled
        canAccess
        actionDescriptor
        actionDescriptorPlural
        didComplete
        isEnrolled
        numActions
        numPeopleCompleted
        numPeopleEnrolled
        userSettings
        space {
          id
          slug
          type
          homeRoute
          avatarUrl
          bannerUrl
          description
          name
          parentGroup {
            id
            avatarUrl
            name
            slug
          }
        }
        publishedAt
      }
    }
  }
}
`

export default function fetchMyTracks ({
  autocomplete = '',
  first = 20,
  offset = 0,
  order = 'asc',
  sortBy = 'enrolled_at'
}) {
  return {
    type: FETCH_MY_TRACKS,
    graphql: {
      query,
      variables: {
        autocomplete,
        first,
        offset,
        order,
        sortBy
      }
    },
    meta: {
      extractModel: 'Me',
      extractQueryResults: {
        getItems: get('payload.data.me.tracksEnrolledIn')
      }
    }
  }
}
