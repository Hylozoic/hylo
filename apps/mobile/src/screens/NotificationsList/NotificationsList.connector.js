import { connect } from 'react-redux'
import { isEmpty } from 'lodash'
import {
  FETCH_NOTIFICATIONS,
  fetchNotifications,
  getNotifications,
  getHasMoreNotifications,
  markActivityRead,
  markAllActivitiesRead,
  updateNewNotificationCount
} from './NotificationsList.store'
import getMemberships from 'store/selectors/getMemberships'

const NOTIFICATIONS_PAGE_SIZE = 20

export function mapStateToProps (state, props) {
  return {
    hasMore: getHasMoreNotifications(state),
    pending: state.pending[FETCH_NOTIFICATIONS],
    notifications: getNotifications(state, props),
    currentUserHasMemberships: !isEmpty(getMemberships(state))
  }
}

export function mapDispatchToProps (dispatch, { navigation }) {
  return {
    fetchNotifications: () => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE)),
    fetchMore: offset => dispatch(fetchNotifications(NOTIFICATIONS_PAGE_SIZE, offset)),
    markAllActivitiesRead: () => dispatch(markAllActivitiesRead()),
    markActivityRead: id => dispatch(markActivityRead(id)),
    updateNewNotificationCount: () => dispatch(updateNewNotificationCount()),
    goToCreateGroup: () => navigation.navigate('Create Group')
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
