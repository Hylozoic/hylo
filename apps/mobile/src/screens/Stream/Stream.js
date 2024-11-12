import React, { useRef, useEffect } from 'react'
import { View, Text, TouchableOpacity } from 'react-native'
import FastImage from 'react-native-fast-image'
import { useNavigation, useRoute } from '@react-navigation/native'
import { capitalize, isEmpty } from 'lodash/fp'
import { useSelector } from 'react-redux'
import { useQuery } from 'urql'
import LinearGradient from 'react-native-linear-gradient'
import useChangeToGroup from 'hooks/useChangeToGroup'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import useGoToTopic from 'hooks/useGoToTopic'
import { useTranslation } from 'react-i18next'
import { getContextGroup, PUBLIC_GROUP_ID } from 'urql-shared/presenters/GroupPresenter'
import topicQuery from 'graphql/queries/topicQuery'
import useRouteParams from 'hooks/useRouteParams'
import getCurrentGroupSlug from 'store/selectors/getCurrentGroupSlug'
import getCustomView from 'store/selectors/getCustomView'
import getMemberships from 'store/selectors/getMemberships'
import fetchGroupDetailsAction from 'store/actions/fetchGroupDetails'
import { firstName } from 'store/models/Person'
import Avatar from 'components/Avatar'
import Button from 'components/Button'
import CreateGroupNotice from 'components/CreateGroupNotice'
import Icon from 'components/Icon'
import StreamList from 'components/StreamList'
import Loading from 'components/Loading'
import SocketSubscriber from 'components/SocketSubscriber'
import GroupWelcomeCheck from 'components/GroupWelcomeCheck'
import ModerationList from 'components/ModerationList'
import { bannerlinearGradientColors } from 'style/colors'
import styles from './Stream.styles'

export function headerTitle (currentGroup, streamType, myHome, t) {
  if (myHome) return myHome
  let title
  title = currentGroup?.name
  title = streamType ? capitalize(t(streamType) + 's') : title
  if (streamType === 'Moderation') title = t('Moderation')
  return title
}

export default function Stream ({ topicName: providedTopicName }) {
  const ref = useRef(null)
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()

  const { customViewId, streamType, myHome, topicName: routeTopicName } = useRouteParams()
  const customView = useSelector(state => getCustomView(state, { customViewId }))
  const changeToGroup = useChangeToGroup()
  const goToTopicDefault = useGoToTopic()
  const topicName = providedTopicName || routeTopicName

  const customViewType = customView?.type
  const customPostTypes = customViewType === 'stream' ? customView?.postTypes : null
  const customViewName = customView?.name
  const customViewIcon = customView?.icon
  // Note: Custom View Mode = grid, etc. Not implemented in App
  // const customViewMode = customView?.defaultViewMode

  const currentUser = useCurrentUser()
  const memberships = useSelector(getMemberships)
  const currentUserHasMemberships = !isEmpty(memberships)
  const currentGroupSlug = useSelector(getCurrentGroupSlug)
  const [{ data }] = useQuery({
    ...fetchGroupDetailsAction({
      slug: currentGroupSlug,
      withExtensions: false,
      withWidgets: false,
      withTopics: false,
      withJoinQuestions: true,
      withPrerequisites: true
    }).graphql,
    pause: !currentGroupSlug || getContextGroup(currentGroupSlug)
  })
  const currentGroup = getContextGroup(currentGroupSlug) || data?.group

  // Topics related: This component re-directs to the WebView chat for Topics
  // within everything but the Public and All My Groups contexts
  const [{ data: topicData }, fetchTopic] = useQuery({
    query: topicQuery,
    variables: { name: topicName },
    pause: true
  })
  const topic = topicData?.topic
  const topicPostsTotal = topic?.postsTotal
  const topicFollowersTotal = topic?.followersTotal
  const goToTopic = selectedTopicName => {
    if (selectedTopicName === topic?.name) return
    if (topic?.name) {
      navigation.setParams({ topicName: selectedTopicName })
    } else {
      goToTopicDefault(selectedTopicName)
    }
  }
  useEffect(() => {
    if (topicName && currentGroup?.slug) {
      fetchTopic()
    }
  }, [topicName, currentGroup?.slug])

  // Keeps header up to date
  useEffect(() => {
    navigation.setOptions({
      title: headerTitle(currentGroup, streamType, myHome, t)
    })
  }, [navigation, topicName, currentGroup, currentGroup?.id, streamType, myHome])

  if (!currentUser) return <Loading style={{ flex: 1 }} />

  // Navigation helpers
  const goToPostDetails = id => navigation.navigate('Post Details', { id })
  const goToCreateGroup = () => navigation.navigate('Create Group')
  const goToMember = id => navigation.navigate('Member', { id })

  if (!currentUserHasMemberships && currentGroup?.id !== PUBLIC_GROUP_ID) {
    return (
      <CreateGroupNotice
        goToCreateGroup={goToCreateGroup}
        text={t('no_posts_here_try_creating_your_own_group')}
      />
    )
  }

  if (!currentGroup) return null

  const name = topicName ? '#' + topicName : currentGroup.name
  const image = currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null
  const pluralFollowers = (topicFollowersTotal !== 1)
  const pluralPosts = (topicPostsTotal !== 1)
  const streamListHeader = (
    <View
      style={[
        styles.bannerContainer,
        styles.bannerContainerWithPostPrompt
      ]}
    >
      <FastImage source={image} style={styles.image} />
      <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} />
      <View style={styles.titleRow}>
        <View style={styles.title}>
          {customViewIcon && (
            <View style={styles.customViewIconContainer}>
              <Icon name={customViewIcon} style={styles.customViewIcon} />
            </View>
          )}
          <Text style={styles.name} numberOfLines={3}>
            {customViewName || myHome || name}
          </Text>
          {topicName && (
            <View style={styles.topicInfo}>
              <Text style={styles.topicInfoText}>
                <Icon name='Star' /> {topicFollowersTotal || 0} subscriber{pluralFollowers && 's'}
              </Text>
              <Text style={styles.topicInfoText}>
                <Icon name='Post' /> {topicPostsTotal || 0} post{pluralPosts && 's'}
              </Text>
            </View>
          )}
        </View>
      </View>
      <PostPrompt
        currentUser={currentUser}
        forGroup={currentGroup}
        currentTopicName={topicName}
        currentType={streamType}
      />
    </View>
  )

  const moderationListHeader = (
    <View
      style={[
        styles.bannerContainer
      ]}
    >
      <FastImage source={image} style={styles.image} />
      <LinearGradient style={styles.gradient} colors={bannerlinearGradientColors} />
      <View style={styles.titleRow}>
        <View style={styles.title}>
          <Text style={styles.name} numberOfLines={3}>
            {customViewName || myHome || name}
          </Text>
        </View>
      </View>
    </View>
  )

  return (
    <>
      <GroupWelcomeCheck groupId={currentGroup?.id} />
      {streamType !== 'moderation' && (
        <StreamList
          scrollRef={ref}
          forGroup={currentGroup}
          showPost={goToPostDetails}
          goToGroup={changeToGroup}
          header={streamListHeader}
          route={route}
          showMember={goToMember}
          showTopic={goToTopic}
          customView={customView}
          topicName={topicName}
          streamType={streamType}
          myHome={myHome}
          // Custom Views
          customPostTypes={customPostTypes}
        />
      )}
      {streamType === 'moderation' && (
        <ModerationList
          scrollRef={ref}
          forGroup={currentGroup}
          header={moderationListHeader}
          route={route}
          streamType={streamType}
        />
      )}
      {!topicName && currentGroup && (
        <SocketSubscriber type='group' id={currentGroup.id} />
      )}
    </>
  )
}

export function postPromptString (type = '', { firstName }, t) {
  const postPrompts = {
    offer: t('Hi {{firstName}}, what would you like to share?', { firstName }),
    request: t('Hi {{firstName}}, what are you looking for?', { firstName }),
    project: t('Hi {{firstName}}, what would you like to create?', { firstName }),
    event: t('Hi {{firstName}}, want to create an event?', { firstName }),
    default: t('Hi {{firstName}}, press here to post', { firstName })
  }

  return postPrompts[type] || postPrompts.default
}

export function PostPrompt ({ currentUser, forGroup, currentType, currentTopicName }) {
  const navigation = useNavigation()
  const { t } = useTranslation()
  const checkedCurrentType = currentType === 'moderation' ? 'discussion' : currentType

  if (!currentUser) return null

  const handleOpenPostEditor = () => (
    navigation.navigate('Edit Post', {
      type: checkedCurrentType,
      groupId: forGroup.id,
      topicName: currentTopicName
    })
  )

  const { avatarUrl } = currentUser

  return (
    <View style={styles.postPrompt}>
      <TouchableOpacity onPress={handleOpenPostEditor} style={styles.promptButton}>
        <Avatar avatarUrl={avatarUrl} style={styles.avatar} />
        <Text style={styles.promptText}>{postPromptString(currentType, { firstName: firstName(currentUser) }, t)}</Text>
      </TouchableOpacity>
    </View>
  )
}

export function SubscribeButton ({ active, onPress }) {
  const { t } = useTranslation()
  const text = active ? t('Unsubscribe') : t('Subscribe')
  const style = active ? styles.unsubscribeButton : styles.subscribeButton
  return <Button onPress={onPress} style={style} iconName='Star' text={text} />
}
