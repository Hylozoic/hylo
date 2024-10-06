import { connect } from 'react-redux'
import { get } from 'lodash/fp'
import { bindActionCreators } from 'redux'
import { getPresentedPost } from 'store/selectors/getPost'
import isPendingFor from 'store/selectors/isPendingFor'
import getCurrentGroup from 'store/selectors/getCurrentGroup'
import upload from 'store/actions/upload'
import fetchPost from 'store/actions/fetchPost'
import createPost from 'store/actions/createPost'
import createProject from 'store/actions/createProject'
import updatePost from 'store/actions/updatePost'
import { pollingFindOrCreateLocation as providedPollingFindOrCreateLocation } from 'screens/LocationPicker/LocationPicker.store'

// TODO: Replace this with useRouteParams when PostEditor is migrated to a functional component
export function getRouteParam (key, route = {}) {
  if (!route) throw new Error('`route` param is empty')

  return get(`params.${key}`, route)
}

export function mapStateToProps (state, props) {
  const currentGroup = get('ref', getCurrentGroup(state))
  const postId = getRouteParam('id', props?.route)
  const post = getPresentedPost(state, { postId })
  // Setup new post with defaults from routing
  const selectedTopicName = get('route.params.topicName', props)
  const providedType = get('route.params.type', props)
  const mapCoordinateLat = getRouteParam('lat', props?.route)
  const mapCoordinateLng = getRouteParam('lng', props?.route)
  const mapCoordinate = mapCoordinateLat && { lat: mapCoordinateLat, lng: mapCoordinateLng }
  const defaultPost = selectedTopicName
    ? {
        topics: [{ name: selectedTopicName }],
        groups: currentGroup && [currentGroup]
      }
    : {
        groups: currentGroup && [currentGroup]
      }

  if (providedType) defaultPost.type = providedType

  return {
    post: post || defaultPost,
    mapCoordinate,
    postLoading: isPendingFor(fetchPost, state)
  }
}

export function mapDispatchToProps (dispatch) {
  return {
    pollingFindOrCreateLocation: (locationData, callback) => {
      return providedPollingFindOrCreateLocation(
        dispatch,
        locationData,
        locationObject => callback(locationObject)
      )
    },
    ...bindActionCreators({
      fetchPost,
      createPost,
      createProject,
      updatePost,
      upload
    }, dispatch)
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
