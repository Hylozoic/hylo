import { trim } from 'lodash/fp'
import { SET_QUERY_SEARCH_TERM } from '../constants'

export default function setQuerySearchTermForScope (searchTerm = '', scope) {
  if (!scope) throw new Error('`scope` param is required for setting a querySearchTerm')

  const searchTermTrimmed = trim(searchTerm) !== ''
    ? trim(searchTerm)
    : undefined

  return {
    type: SET_QUERY_SEARCH_TERM,
    payload: {
      scope,
      searchTerm: searchTermTrimmed
    }
  }
}
