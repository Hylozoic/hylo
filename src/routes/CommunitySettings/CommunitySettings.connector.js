import { push } from 'connected-react-router'
import { get } from 'lodash/fp'
import { connect } from 'react-redux'
import getCommunityForCurrentRoute from 'store/selectors/getCommunityForCurrentRoute'
import getRouteParam from 'store/selectors/getRouteParam'
import getCanModerate from 'store/selectors/getCanModerate'
import getMe from 'store/selectors/getMe'
import {
  fetchCommunitySettings, updateCommunitySettings, deleteCommunity
} from './CommunitySettings.store'
import { communityDeleteConfirmationUrl } from 'util/navigation'

export function mapStateToProps (state, props) {
  const slug = getRouteParam('slug', state, props, false)
  const community = getCommunityForCurrentRoute(state, props)
  const canModerate = getCanModerate(state, { community })

  return {
    canModerate,
    community,
    currentUser: getMe(state),
    slug
  }
}

export function mapDispatchToProps (dispatch, props) {
  return {
    deleteCommunity: id => dispatch(deleteCommunity(id)),
    fetchCommunitySettingsMaker: slug => () => dispatch(fetchCommunitySettings(slug)),
    goToCommunityDeleteConfirmation: () => dispatch(push(communityDeleteConfirmationUrl())),
    updateCommunitySettingsMaker: id => changes => dispatch(updateCommunitySettings(id, changes))
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { community, slug } = stateProps
  const {
    fetchCommunitySettingsMaker, goToCommunityDeleteConfirmation, updateCommunitySettingsMaker
  } = dispatchProps
  let deleteCommunity, fetchCommunitySettings, updateCommunitySettings

  if (slug) {
    fetchCommunitySettings = fetchCommunitySettingsMaker(slug)
  } else {
    fetchCommunitySettings = () => {}
  }

  if (get('id', community)) {
    deleteCommunity = () =>
      dispatchProps.deleteCommunity(community.id)
        .then(({ error }) => {
          if (!error) {
            return goToCommunityDeleteConfirmation()
          }
        })
    updateCommunitySettings = updateCommunitySettingsMaker(community.id)
  } else {
    deleteCommunity = () => {}
    updateCommunitySettings = () => {}
  }

  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    deleteCommunity,
    fetchCommunitySettings,
    updateCommunitySettings
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
