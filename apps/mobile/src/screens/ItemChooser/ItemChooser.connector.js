import { connect } from 'react-redux'
import isPendingFor from 'store/selectors/isPendingFor'
import {
  getScreenTitle,
  getSearchTerm,
  setSearchTerm,
  getSearchSuggestions as defaultGetSearchSuggestions
} from './ItemChooser.store'

export function mapStateToProps (state, props) {
  const screenTitle = getScreenTitle({}, props)
  const searchTerm = getSearchTerm(state, props)
  const getSearchSuggestions = props.route.params.getSearchSuggestions
    ? props.route.params.getSearchSuggestions
    : defaultGetSearchSuggestions

  return {
    ...props.route.params,
    searchTerm,
    suggestedItems: getSearchSuggestions(state, { ...props, searchTerm, autocomplete: searchTerm }),
    loading: isPendingFor(screenTitle, state)
  }
}

export function mapDispatchToProps (dispatch, props) {
  const screenTitle = getScreenTitle({}, props)
  const { fetchSearchSuggestions, searchTermFilter } = props.route.params

  return {
    fetchSearchSuggestions: searchTerm => dispatch(fetchSearchSuggestions(screenTitle, searchTerm)),
    setSearchTerm: (searchTerm, opts) => dispatch(setSearchTerm(screenTitle, searchTerm, { ...opts, searchTermFilter }))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
