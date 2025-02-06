import React, { useRef, useEffect, useCallback, useState } from 'react'
import { useNavigation, useIsFocused, useRoute } from '@react-navigation/native'
import { FlatList, View, TouchableOpacity } from 'react-native'
import { gql, useMutation, useQuery } from 'urql'
import { capitalize, get, isEmpty } from 'lodash/fp'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import useStreamQueryVariables from '@hylo/hooks/useStreamQueryVariables'
import { useTranslation } from 'react-i18next'
import { PUBLIC_GROUP_ID } from '@hylo/presenters/GroupPresenter'
import useRouteParams from 'hooks/useRouteParams'
import makeStreamQuery from './makeStreamQuery'
import StreamHeader from './StreamHeader'
import PostRow from './PostRow'
import CreateGroupNotice from 'components/CreateGroupNotice'
import GroupWelcomeCheck from 'components/GroupWelcomeCheck'
import Icon from 'components/Icon'
import ListControl from 'components/ListControl'
import Loading from 'components/Loading'
import ModerationList from 'components/ModerationList'
import styles from './Stream.styles'
import { pictonBlue } from 'style/colors'

/* === CONSTANTS === */

// tracks: `apps/web/src/components/StreamViewControls/StreamViewControls.js`
export const POST_TYPE_OPTIONS = [
  { id: undefined, label: 'All Posts' },
  { id: 'discussion', label: 'Discussions' },
  { id: 'event', label: 'Events' },
  { id: 'offer', label: 'Offers' },
  { id: 'project', label: 'Projects' },
  { id: 'proposal', label: 'Proposals' },
  { id: 'request', label: 'Requests' },
  { id: 'resource', label: 'Resources' }
]
// tracks: `apps/web/src/util/constants.js`
export const STREAM_SORT_OPTIONS = [
  { id: 'updated', label: 'Latest activity' },
  { id: 'created', label: 'Post Date' },
  { id: 'reactions', label: 'Popular' }
]
// tracks: `apps/web/src/util/constants.js`
export const COLLECTION_SORT_OPTIONS = [
  { id: 'order', label: 'Manual' },
  { id: 'updated', label: 'Latest activity' },
  { id: 'created', label: 'Post Date' },
  { id: 'reactions', label: 'Popular' }
]
// tracks: `apps/web/src/routes/Events/Events.js`
export const EVENT_STREAM_TIMEFRAME_OPTIONS = [
  { id: 'future', label: 'Upcoming Events' },
  { id: 'past', label: 'Past Events' }
]

export const DECISIONS_OPTIONS = [
  { id: 'proposal', label: 'Proposals' },
  { id: 'moderation', label: 'Moderation' }
]

export const DEFAULT_SORT_BY_ID = 'updated'
export const DEFAULT_TIMEFRAME_ID = 'future'

// Currently unused
export const resetGroupTopicNewPostCountMutation = gql`
  mutation ResetGroupTopicNewPostCountMutation($id: ID) {
    updateGroupTopicFollow(id: $id, data: { newPostCount: 0 }) {
      success
    }
  }
`

export const resetGroupNewPostCountMutation = gql`
  mutation ResetGroupNewPostCountMutation ($id: ID) {
    updateMembership(groupId: $id, data: { newPostCount: 0 }) {
      id
    }
  }
`

export default function Stream () {
  const ref = useRef(null)
  const { t } = useTranslation()
  const navigation = useNavigation()
  const route = useRoute()
  const isFocused = useIsFocused()
  const { customViewId, streamType, myHome } = useRouteParams()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()

  const customView = currentGroup?.customViews?.items?.find(view => view.id === customViewId)
  const [filter, setFilter] = useState()
  const [sortBy, setSortBy] = useState(
    get('settings.streamSortBy', currentUser) ||
    customView?.defaultSort ||
    DEFAULT_SORT_BY_ID
  )
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME_ID)
  const [offset, setOffset] = useState(0)
  const fetchPostParam = useStreamQueryVariables({
    currentUser,
    customView,
    streamType,
    filter,
    forGroup: currentGroup,
    myHome,
    sortBy,
    timeframe
  })

  const [{ data, fetching }, refetchPosts] = useQuery(makeStreamQuery({ ...fetchPostParam, offset }))
  const postsQuerySet = data?.posts || data?.group?.posts
  const hasMore = postsQuerySet?.hasMore
  const posts = postsQuerySet?.items
  const postIds = posts?.map(p => p.id)

  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [, resetGroupNewPostCount] = useMutation(resetGroupNewPostCountMutation)

  useEffect(() => {
    navigation.setOptions({
      title: myHome || streamType === 'Moderation'
        ? t('Moderation')
        : streamType
          ? capitalize(t(streamType) + 's')
          : currentGroup?.name
    })
  }, [navigation, currentGroup?.id, streamType, myHome])

  // TODO: URQL - Can this be simplified? Also, does this perhaps follow the same logic as
  // group(updateLastViewed: true) and could we combine this? Currently that extra
  // query arg for GroupDetailsQuery makes the URQL caching not merged, so it would be nice
  // to run it independently or make it a mutation, like this resetGroupNewPostCount
  useEffect(() => {
    if (fetchPostParam && isFocused && isEmpty(postIds) && hasMore !== false) {
      const slug = fetchPostParam.context

      if (
        currentGroup?.id &&
        !currentGroup?.isContextGroup &&
        sortBy === DEFAULT_SORT_BY_ID &&
        !fetchPostParam.filter
      ) {
        resetGroupNewPostCount({ id: currentGroup?.id })
      }
    }
  }, [currentGroup?.id, fetchPostParam?.filter, fetchPostParam?.context, hasMore, isFocused, postIds])

  // Only custom views can be sorted by manual order
  useEffect(() => {
    if (!customView && sortBy === 'order') {
      setOffset(0)
      setSortBy('updated')
    }
  }, [customView, sortBy])

  const refreshPosts = useCallback(() => {
    if (fetchPostParam) {
      setOffset(0)
      refetchPosts({ requestPolicy: 'network-only' })
    }
  }, [fetchPostParam, refetchPosts])

  const fetchMorePosts = useCallback(() => {
    if (posts && !fetching) {
      setOffset(curOffset => curOffset + posts?.length)
    }
  }, [hasMore, fetching, postIds])

  const sortOptions = customView?.type === 'collection'
    ? COLLECTION_SORT_OPTIONS
    : STREAM_SORT_OPTIONS

  const handleChildPostToggle = () => {
    const childPostInclusion = fetchPostParam?.childPostInclusion === 'yes' ? 'no' : 'yes'
    updateUserSettings({ changes: { settings: { streamChildPosts: childPostInclusion } } })
  }

  const extraToggleStyles = fetchPostParam?.childPostInclusion === 'yes'
    ? { backgroundColor: pictonBlue }
    : { backgroundColor: '#FFFFFF' }

  if (!fetchPostParam) return null
  if (!currentUser) return <Loading style={{ flex: 1 }} />
  if (!currentGroup) return null

  if (isEmpty(currentUser?.memberships) && currentGroup?.id !== PUBLIC_GROUP_ID) {
    return (
      <CreateGroupNotice />
    )
  }

  if (streamType === 'moderation') {
    return (
      <ModerationList
        scrollRef={ref}
        forGroup={currentGroup}
        header={(
          <StreamHeader
            image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
            icon={customView?.icon}
            name={customView?.name || myHome || currentGroup.name}
          />
        )}
        route={route}
        streamType={streamType}
      />
    )
  }

  return (
    <View style={styles.container}>
      <GroupWelcomeCheck />
      <FlatList
        ref={ref}
        data={posts}
        renderItem={({ item }) => (
          <PostRow
            context={fetchPostParam?.context}
            post={item}
            forGroupId={currentGroup?.id}
            showGroups={!currentGroup?.id || currentGroup?.isContextGroup}
          />
        )}
        onRefresh={refreshPosts}
        refreshing={fetching}
        keyExtractor={item => `post${item.id}`}
        // TODO: URQL! - Without further setup FlatList will call this many many times while still at the bottom
        // currently URQL is protecting us from this by caching an throttling the many api requests it creates,
        // but it definitely needs to be elaborated such that only a single call is send and that call can start
        // probably a higher than default bottom threshold so the additional posts are closer to already
        // there by the time the user gets to the bottom bottom. All pretty to easy to fix, and should make
        // our infinite scroll smoother than it is at the moment due to this hammer of requests.
        onEndReached={fetchMorePosts}
        ListHeaderComponent={
          <View>
            <StreamHeader
              image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
              icon={customView?.icon}
              name={customView?.name || myHome || currentGroup.name}
              currentGroup={currentGroup}
              streamType={streamType}
              customView={customView}
              postPrompt
            />

            {!streamType && (
              <View style={[styles.listControls]}>
                <ListControl selected={sortBy} onChange={setSortBy} options={sortOptions} />
                <View style={styles.steamControlRightSide}>
                  {!['my', 'public'].includes(fetchPostParam?.context) &&
                    <TouchableOpacity onPress={handleChildPostToggle}>
                      <View style={{ ...styles.childGroupToggle, ...extraToggleStyles }}>
                        <Icon name='Subgroup' color={fetchPostParam?.childPostInclusion === 'yes' ? '#FFFFFF' : pictonBlue} />
                      </View>
                    </TouchableOpacity>}
                  {!fetchPostParam?.types && (
                    <ListControl selected={fetchPostParam.filter} onChange={setFilter} options={POST_TYPE_OPTIONS} />
                  )}
                </View>
              </View>
            )}

            {streamType === 'event' && (
              <View style={[styles.listControls]}>
                <ListControl selected={timeframe} onChange={setTimeframe} options={EVENT_STREAM_TIMEFRAME_OPTIONS} />
              </View>
            )}

            {streamType === 'proposal' && (
              <View style={[styles.listControls]}>
                <ListControl
                  selected={streamType}
                  onChange={() => (
                    navigation.navigate('Decisions', { streamType: 'moderation', initial: false, options: { title: 'Moderation' } })
                  )}
                  options={DECISIONS_OPTIONS}
                />
              </View>
            )}

          </View>
        }
        ListFooterComponent={(
          fetching ? <Loading style={styles.loading} /> : null
        )}
      />
    </View>
  )
}
