import React, { useRef, useEffect, useCallback, useState, useMemo } from 'react'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { View, TouchableOpacity, Dimensions } from 'react-native'
import { useTranslation } from 'react-i18next'
import { FlashList } from '@shopify/flash-list'
import { useMutation, useQuery } from 'urql'
import { capitalize, isEmpty } from 'lodash/fp'
import { clsx } from 'clsx'
import { MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG } from '@hylo/navigation'
import { isStaticContext } from '@hylo/presenters/GroupPresenter'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import updateMembershipMutation from '@hylo/graphql/mutations/updateMembershipMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useStreamQueryVariables from '@hylo/hooks/useStreamQueryVariables'
import useRouteParams from 'hooks/useRouteParams'
import makeStreamQuery from './makeStreamQuery'
import CreateGroupNotice from 'components/CreateGroupNotice'
import Icon from 'components/Icon'
import ListControl from 'components/ListControl'
import Loading from 'components/Loading'
import PostRow from './PostRow'
import StreamHeader from './StreamHeader'
import Colors from '../../style/theme-colors'

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

export const DEFAULT_SORT_BY_ID = 'updated'
export const DEFAULT_TIMEFRAME_ID = 'future'

export default function Stream () {
  const ref = useRef(null)
  const { t } = useTranslation()
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup }] = useCurrentGroup()
  const routeParams = useRouteParams()
  const {
    context,
    customViewId,
    view: providedView,
    streamType,
    topicName
  } = routeParams

  const view = (context === MY_CONTEXT_SLUG && !providedView && !streamType) ? 'posts' : providedView

  const customView = currentGroup?.customViews?.items?.find(customView => customView.id === customViewId)
  const [filter, setFilter] = useState(
    customView?.defaultPostType ||
    currentUser?.settings?.streamPostType ||
    'all'
  )
  const [sortBy, setSortBy] = useState(
    customView?.defaultSort ||
    currentUser?.settings?.streamSortBy ||
    DEFAULT_SORT_BY_ID
  )
  const [childPostInclusion, setChildPostInclusion] = useState(
    currentUser?.settings?.streamChildPosts ||
    'yes'
  )
  const [timeframe, setTimeframe] = useState(DEFAULT_TIMEFRAME_ID)
  const [offset, setOffset] = useState(0)
  const streamQueryVariables = useStreamQueryVariables({
    childPostInclusion,
    context,
    currentUser,
    customView,
    streamType,
    filter,
    slug: !isStaticContext(currentGroup?.slug) ? currentGroup?.slug : null,
    view,
    sortBy,
    timeframe,
    topic: topicName
  })
  const [{ data, fetching }, refetchPosts] = useQuery(makeStreamQuery({ ...streamQueryVariables, offset }))
  const postsQuerySet = data?.posts || data?.group?.posts
  const hasMore = postsQuerySet?.hasMore
  const posts = postsQuerySet?.items
  const postIds = posts?.map(p => p.id)

  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [, resetGroupNewPostCount] = useMutation(updateMembershipMutation)

  const title = useMemo(() => {
    if (customView?.name) {
      return customView?.name
    }

    switch (streamType) {
      case 'event':
        return t('Events')
      case 'projects':
        return t('Projects')
      case 'proposal':
        return t('Proposals')
    }

    if (streamType) {
      return capitalize(t(streamType))
    }

    if (context === MY_CONTEXT_SLUG && view) {
      return capitalize(t(view))
    }

    return t('Stream')
  }, [navigation, currentGroup?.id, view, streamType, context])

  // TODO: URQL - Can this be simplified? Also, does this perhaps follow the same logic as
  // group(updateLastViewed: true) and could we combine this? Currently that extra
  // query arg for GroupDetailsQuery makes the URQL caching not merged, so it would be nice
  // to run it independently or make it a mutation, like this resetGroupNewPostCount
  useEffect(() => {
    if (streamQueryVariables && isFocused && isEmpty(postIds) && hasMore !== false) {
      if (
        currentGroup?.id &&
        !currentGroup?.isStaticContext &&
        sortBy === DEFAULT_SORT_BY_ID &&
        !streamQueryVariables.filter
      ) {
        resetGroupNewPostCount({ groupId: currentGroup?.id, data: { newPostCount: 0 } })
      }
    }
  }, [currentGroup?.id, streamQueryVariables?.filter, streamQueryVariables?.context, hasMore, isFocused, postIds])

  // Only custom views can be sorted by manual order
  useEffect(() => {
    if (!customView && sortBy === 'order') {
      setOffset(0)
      setSortBy('updated')
    }
  }, [customView, sortBy])

  const refreshPosts = useCallback(() => {
    if (streamQueryVariables) {
      setOffset(0)
      refetchPosts({ requestPolicy: 'network-only' })
    }
  }, [streamQueryVariables, refetchPosts])

  const fetchMorePosts = useCallback(() => {
    if (hasMore && !fetching) {
      setOffset(curOffset => curOffset + posts?.length)
    }
  }, [hasMore, fetching, postIds])

  const sortOptions = customView?.type === 'collection'
    ? COLLECTION_SORT_OPTIONS
    : STREAM_SORT_OPTIONS

  const handleChildPostToggle = () => {
    const childPostInclusion = streamQueryVariables?.childPostInclusion === 'yes' ? 'no' : 'yes'
    setChildPostInclusion(childPostInclusion)
    updateUserSettings({ changes: { settings: { streamChildPosts: childPostInclusion } } })
  }

  const handleFilterChange = (filter) => {
    setFilter(filter)
    updateUserSettings({ changes: { settings: { streamPostType: filter || null } } })
  }

  const handleSortChange = (sortBy) => {
    setSortBy(sortBy)
    updateUserSettings({ changes: { settings: { streamSortBy: sortBy } } })
  }

  if (!streamQueryVariables) return null
  if (!currentUser) return <Loading style={{ flex: 1 }} />
  if (!currentGroup) return null

  if (isEmpty(currentUser?.memberships) && currentGroup?.slug !== PUBLIC_CONTEXT_SLUG) {
    return (
      <CreateGroupNotice />
    )
  }

  return (
    <View className='bg-background flex-1'>
      <View
        style={{
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowRadius: 6,
          shadowOpacity: 0.1,
          elevation: 6,
          backgroundColor: Colors.background20,
          zIndex: 10
        }}
      >
        <StreamHeader
          image={currentGroup.bannerUrl ? { uri: currentGroup.bannerUrl } : null}
          icon={customView?.icon}
          name={title}
          currentGroup={currentGroup}
          streamType={streamQueryVariables.filter}
          customView={customView}
          postPrompt
        />
        {!streamType && (
          <View className='flex-row justify-between items-center px-2.5 py-2'>
            <ListControl selected={sortBy} onChange={handleSortChange} options={sortOptions} />
            <View className='flex-row items-center gap-2'>
              {![MY_CONTEXT_SLUG, PUBLIC_CONTEXT_SLUG].includes(streamQueryVariables?.context) &&
                <TouchableOpacity onPress={handleChildPostToggle}>
                  <View className={clsx(
                    'w-8 h-8 rounded items-center justify-center',
                    streamQueryVariables?.childPostInclusion === 'yes'
                      ? 'bg-secondary'
                      : 'bg-background border border-secondary'
                  )}
                  >
                    <Icon
                      name='Subgroup'
                      className={clsx(
                        streamQueryVariables?.childPostInclusion === 'yes'
                          ? 'text-background'
                          : 'text-secondary'
                      )}
                    />
                  </View>
                </TouchableOpacity>}
              {!streamQueryVariables?.types && (
                <ListControl
                  selected={streamQueryVariables.filter}
                  onChange={handleFilterChange}
                  options={POST_TYPE_OPTIONS}
                />
              )}
            </View>
          </View>
        )}

        {streamType === 'event' && (
          <View className='px-2.5 py-2'>
            <ListControl
              selected={timeframe}
              onChange={setTimeframe}
              options={EVENT_STREAM_TIMEFRAME_OPTIONS}
            />
          </View>
        )}
      </View>
      <FlashList
        contentContainerStyle={{ paddingTop: 12 }}
        estimatedItemSize={200}
        estimatedListSize={Dimensions.get('screen')}
        ref={ref}
        data={posts}
        renderItem={({ item }) => (
          <PostRow
            context={streamQueryVariables?.context}
            post={item}
            forGroupId={currentGroup?.id}
            showGroups={!currentGroup?.id || currentGroup?.isStaticContext}
          />
        )}
        onRefresh={refreshPosts}
        refreshing={fetching}
        keyExtractor={item => `post${item.id}`}
        onEndReached={fetchMorePosts}
        ListFooterComponent={
          fetching ? <Loading className='py-5' /> : null
        }
      />
    </View>
  )
}
