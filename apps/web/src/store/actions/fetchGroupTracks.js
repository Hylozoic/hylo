import { get } from 'lodash/fp'

export const FETCH_GROUP_TRACKS = 'FETCH_GROUP_TRACKS'

const query = `
query (
  $id: ID,
  $first: Int,
  $offset: Int,
  $sortBy: String,
  $order: String,
  $enrolled: Boolean,
  $autocomplete: String
) {
  group (id: $id) {
    id
    tracks (autocomplete: $autocomplete, enrolled: $enrolled, first: $first, offset: $offset, sortBy: $sortBy, order: $order) {
      items {
        id
        bannerUrl
        actionsName
        description
        completionMessage
        completionRole {
          ... on CommonRole {
            id
            emoji
            name
          }
          ... on GroupRole {
            id
            emoji
            name
          }
        }
        completionRoleType
        didComplete
        isEnrolled
        name
        numActions
        numPeopleCompleted
        numPeopleEnrolled
        publishedAt
        userSettings
        welcomeMessage
      }
    }
  }
}
`

export default function fetchGroupTracks (groupId, {
  autocomplete = '',
  enrolled = null,
  first = 20,
  offset = 0,
  order = 'desc',
  sortBy = 'published_at'
}) {
  return {
    type: FETCH_GROUP_TRACKS,
    graphql: {
      query,
      variables: {
        id: groupId,
        autocomplete,
        enrolled,
        first,
        offset,
        order,
        sortBy
      }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.tracks')
      }
    }
  }
}
