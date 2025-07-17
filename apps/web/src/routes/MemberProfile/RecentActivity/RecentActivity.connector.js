import { connect } from 'react-redux'
import {
  getRecentActivity,
  fetchRecentActivity,
  hasMoreActivity
} from './RecentActivity.store'

export function mapStateToProps (state, props) {
  const personId = props.routeParams.personId
  const activityItems = getRecentActivity(state, props)
  // Find the person in the ORM state
  const person = state.orm?.Person?.items?.find(p => p.id === personId)
  return {
    activityItems,
    hasMore: hasMoreActivity(person)
  }
}

export function mapDispatchToProps (dispatch, props) {
  return {
    fetchRecentActivity: (offset = 0) => dispatch(fetchRecentActivity(props.routeParams.personId, 10, offset))
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
