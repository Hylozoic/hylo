import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { debounce } from 'lodash/fp'
import { modalScreenName } from 'hooks/useIsModalScreen'
import {
  fetchSearchResults,
  setSearchTerm,
  getSearchTerm,
  setSearchFilter,
  getSearchFilter,
  getSearchResults,
  getHasMoreSearchResults,
  FETCH_SEARCH
} from './SearchPage.store'

export function mapStateToProps (state, props) {
  const searchTerm = getSearchTerm(state, props)
  const filter = getSearchFilter(state, props)

  const queryResultProps = { search: searchTerm, type: filter }

  const searchResults = getSearchResults(state, queryResultProps)
  const hasMore = getHasMoreSearchResults(state, queryResultProps)
  const pending = !!state.pending[FETCH_SEARCH]

  // TODO: Fix back links on Home Tab when navigating this way,
  // currently causes a crash if trying to go back from Post Details or Member
  const goToPost = id => props.navigation.navigate(modalScreenName('Post Details'), { id })
  const goToPerson = id => props.navigation.navigate(modalScreenName('Member'), { id })

  return {
    searchTerm,
    filter,
    searchResults,
    hasMore,
    pending,
    goToPost,
    goToPerson
  }
}

export function mapDispatchToProps (dispatch) {
  return {
    fetchSearchResults: debounce(400, params => dispatch(fetchSearchResults(params))),
    ...bindActionCreators({
      setSearchTerm,
      setSearchFilter
    }, dispatch)
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { searchTerm, filter, searchResults, hasMore } = stateProps

  const fetchSearchResults = () =>
    dispatchProps.fetchSearchResults({ search: searchTerm, filter })

  const fetchMoreSearchResults = () => hasMore
    ? dispatchProps.fetchSearchResults({ search: searchTerm, offset: searchResults.length, filter })
    : () => {}

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    fetchSearchResults,
    fetchMoreSearchResults
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
