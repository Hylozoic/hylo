import {
  makeGetQueryResults,
  makeQueryResultsModelSelector
} from 'store/reducers/queryResults'
import { FETCH_PEOPLE_AUTOCOMPLETE } from 'store/constants'

export default function scopedGetPeopleAutocomplete (scope) {
  const queryResultsScope = scope
    ? `${scope}/${FETCH_PEOPLE_AUTOCOMPLETE}`
    : FETCH_PEOPLE_AUTOCOMPLETE
  const getPeopleAutocompleteResults = makeGetQueryResults(queryResultsScope)

  return makeQueryResultsModelSelector(
    getPeopleAutocompleteResults,
    'Person',
    person => person.ref
  )
}
