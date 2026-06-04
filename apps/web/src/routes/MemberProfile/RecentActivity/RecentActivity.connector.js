import { connect } from 'react-redux'
import {
  getRecentActivity,
  fetchRecentActivity,
  hasMoreActivity
} from './RecentActivity.store'

export function mapStateToProps (state, props) {
  const personId = props.routeParams.personId
  const activityItems = getRecentActivity(state, props)
  const person = state.orm?.Person?.itemsById?.[personId]
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
