import { connect } from 'react-redux'
import { push } from 'redux-first-history'
import { get } from 'lodash/fp'
import { getTopicsFromSubscribedGroupTopics } from './TopicNavigation.store'
import resetNewPostCount from 'store/actions/resetNewPostCount'
import { topicsUrl, allGroupsUrl } from '@hylo/navigation'
import { FETCH_POSTS } from 'store/constants'
import { makeDropQueryResults } from 'store/reducers/queryResults'

export function mapStateToProps (state, props) {
  const { routeParams } = props
  const topics = getTopicsFromSubscribedGroupTopics(state, props)

  return {
    streamFetchPostsParam: get('Stream.fetchPostsParam', state),
    seeAllUrl: topicsUrl(routeParams, allGroupsUrl()),
    routeParams,
    topics
  }
}

const dropPostResults = makeDropQueryResults(FETCH_POSTS)

export function mapDispatchToProps (dispatch, props) {
  return {
    clearBadge: id => dispatch(resetNewPostCount(id, 'TopicFollow')),
    dropPostResultsMaker: props => () => dispatch(dropPostResults(props)),
    goBack: event => {
      // this action is assigned to an element inside a link, so preventDefault
      // stops the link from being clicked
      event.preventDefault()
      return dispatch(push(props.backUrl))
    }
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    clearStream: dispatchProps.dropPostResultsMaker(stateProps.streamFetchPostsParam)
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
