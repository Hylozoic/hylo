import { connect } from 'react-redux'
import { bindActionCreators } from 'redux'
import { get } from 'lodash/fp'
import { isEmpty, isNull, isUndefined } from 'lodash'

import getMe from '../../store/selectors/getMe'
import getNetwork from '../../store/selectors/getNetwork'
import getCommunity from '../../store/selectors/getCommunity'
import getCurrentCommunityId from '../../store/selectors/getCurrentCommunityId'
import getCurrentNetworkId from '../../store/selectors/getCurrentNetworkId'
import makeGoToCommunity from '../../store/actions/makeGoToCommunity'
import { ALL_COMMUNITIES_ID } from '../../store/models/Community'
import {
  fetchCommunityTopic,
  getCommunityTopic,
  setTopicSubscribe,
  getCommunitySearchObject,
  getNetworkSearchObject
} from './Feed.store'
import getMemberships from '../../store/selectors/getMemberships'
import getNavigationParam from '../../store/selectors/getNavigationParam'

export function mapStateToProps (state, props) {
  const params = get('state.params', props.navigation) || {}
  // NOTE: networkId is only received as a prop (currently via Home)
  const networkId = getCurrentNetworkId(state, props)
  // NOTE: communityId is is received either as a prop (via Home) or as a
  // navigation parameter. In case of nav params the screen will load with a
  // back button and be added to the stack.
  const communityId = getNavigationParam('communityId', state, props) ||
                        getCurrentCommunityId(state, props)
  const communitySlugFromLink = getNavigationParam('communitySlugFromLink', state, props)
  const communitySearchObject = getCommunitySearchObject(communityId, communitySlugFromLink)

  const topicName = props.topicName || params.topicName || getNavigationParam('topicName', state, props)
  const community = !networkId && get('ref', getCommunity(state, communitySearchObject))
  const communitySlug = get('slug', community)

  const networkSlug = getNavigationParam('networkSlug', state, props)
  const networkSearchObject = getNetworkSearchObject(networkId, networkSlug)

  const network = getNetwork(state, networkSearchObject)
  const currentUser = getMe(state)
  const communityTopic = topicName && community &&
    getCommunityTopic(state, {topicName, slug: community.slug})
  const topicSubscribed = topicName && communityTopic && communityTopic.isSubscribed
  const topic = get('topic.ref', communityTopic)
  const currentUserHasMemberships = !isEmpty(getMemberships(state))

  return {
    currentUser,
    community,
    network,
    topic,
    postsTotal: get('postsTotal', communitySlug ? communityTopic : topic),
    followersTotal: get('followersTotal', communitySlug ? communityTopic : topic),
    topicName,
    topicSubscribed,
    currentUserHasMemberships
  }
}

export function mapDispatchToProps (dispatch, { navigation }) {
  return {
    newPost: (communityId, topicName) => navigation.navigate('PostEditor', {communityId, topicName}),
    showPost: id => navigation.navigate('PostDetails', { id }),
    showMember: id => navigation.navigate('MemberProfile', { id }),
    showTopic: (communityId, networkId) => topicName => {
      // All Communities and Network feed to topic nav
      // currently not supported
      if (networkId || communityId === ALL_COMMUNITIES_ID || (isNull(communityId) || isUndefined(communityId))) {
        navigation.navigate('TopicSupportComingSoon')
      } else {
        navigation.navigate('Feed', { communityId, topicName })
      }
    },
    goToCommunity: makeGoToCommunity(dispatch, navigation),
    ...bindActionCreators({
      fetchCommunityTopic,
      setTopicSubscribe
    }, dispatch),
    goToCreateCommunityName: () => {
      navigation.navigate('CreateCommunityName')
    }
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { community, network, topic, topicName, topicSubscribed } = stateProps
  const communityId = get('id', community)
  const networkId = get('id', network)
  const slug = get('slug', community)
  return {
    ...stateProps,
    ...dispatchProps,
    ...ownProps,
    newPost: () => dispatchProps.newPost(communityId, topicName),
    showTopic: dispatchProps.showTopic(communityId, networkId),
    fetchCommunityTopic: topicName && slug
      ? () => dispatchProps.fetchCommunityTopic(topicName, slug)
      : () => {},
    setTopicSubscribe: topic && communityId
      ? () => dispatchProps.setTopicSubscribe(topic.id, communityId, !topicSubscribed)
      : () => {}
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
