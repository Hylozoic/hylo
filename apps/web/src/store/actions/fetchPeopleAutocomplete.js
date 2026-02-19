import { get } from 'lodash/fp'
import { FETCH_PEOPLE_AUTOCOMPLETE } from 'store/constants'
import PeopleAutocompleteQuery from '@graphql/queries/PeopleAutocompleteQuery'

/**
 * Fetches people using autocomplete search across all users on the platform.
 * Unlike fetchPeople which queries group members, this uses the root-level
 * people query which can search all users.
 */
export default function fetchPeopleAutocomplete ({ autocomplete, first = 10 }) {
  return {
    type: FETCH_PEOPLE_AUTOCOMPLETE,
    graphql: {
      query: PeopleAutocompleteQuery,
      variables: { autocomplete, first }
    },
    meta: {
      extractModel: 'Person',
      extractQueryResults: {
        getItems: get('payload.data.people.items')
      }
    }
  }
}
