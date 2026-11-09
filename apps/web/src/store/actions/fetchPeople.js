import { get } from 'lodash/fp'
import { FETCH_PEOPLE } from 'store/constants'
import PeopleQuery from '@graphql/queries/PeopleQuery'

export default function fetchPeople ({
  autocomplete,
  groupIds,
  first = 20,
  query = PeopleQuery,
  offset = 0,
  includeMemberships = false
}) {
  return {
    type: FETCH_PEOPLE,
    graphql: {
      query,
      variables: { autocomplete, first, groupIds, offset, includeMemberships }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members')
      }
    }
  }
}
