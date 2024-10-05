import { connect } from 'react-redux'
import { get, isUndefined } from 'lodash/fp'
import fetchThreads from 'store/actions/fetchThreads'
import { FETCH_THREADS } from 'store/constants'
import getMe from 'store/selectors/getMe'
import { getThreads, getThreadsHasMore, updateLastViewed } from './ThreadList.store'

export function mapStateToProps (state, props) {
  const threads = getThreads(state, props)
  const currentUser = getMe(state)
  const hasMore = getThreadsHasMore(state, props)
  const pending = state.pending[FETCH_THREADS] || isUndefined(state.pending[FETCH_THREADS])
  const showThread = threadOrId => props.navigation.navigate('Thread', {
    id: get('id', threadOrId) || threadOrId
  })

  return {
    currentUser,
    hasMore,
    isConnected: state.SocketListener.connected,
    pending,
    pendingRefresh: !!(pending && pending?.extractQueryResults?.reset),
    threads,
    showThread
  }
}

export const mapDispatchToProps = {
  updateLastViewed,
  fetchThreads
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { threads, hasMore } = stateProps

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    fetchThreads: () => {
      dispatchProps.fetchThreads(10)
      dispatchProps.updateLastViewed()
    },
    fetchMoreThreads: hasMore
      ? () => dispatchProps.fetchThreads(10, threads.length)
      : () => {},
    refreshThreads: () => dispatchProps.fetchThreads(10, 0, true)
  }
}

export default connect(
  mapStateToProps,
  mapDispatchToProps,
  mergeProps
)
