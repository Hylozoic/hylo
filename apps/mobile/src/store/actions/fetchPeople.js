import { get } from 'lodash/fp'
import { FETCH_PEOPLE } from 'store/constants'
import peopleQuery from 'graphql/queries/peopleQuery'

export default function fetchPeople ({ autocomplete, groupIds, first = 20, query = peopleQuery, offset = 0 }) {
  return {
    type: FETCH_PEOPLE,
    graphql: {
      query,
      variables: { autocomplete, first, groupIds, offset }
    },
    meta: {
      extractModel: 'Group',
      extractQueryResults: {
        getItems: get('payload.data.group.members')
      }
    }
  }
}
