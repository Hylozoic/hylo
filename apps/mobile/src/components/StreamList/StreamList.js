import React, { useCallback, useEffect, useState } from 'react'
import { gql, useMutation, useQuery } from 'urql'
import { FlatList, View, TouchableOpacity } from 'react-native'
import { isEmpty, get } from 'lodash/fp'
import { useIsFocused, useNavigation } from '@react-navigation/native'
import { ALL_GROUP_ID, isContextGroupSlug, MY_CONTEXT_ID, PUBLIC_GROUP_ID } from '@hylo/presenters/GroupPresenter'
import useStreamQueryVariables from '@hylo/hooks/useStreamQueryVariables'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import { makeStreamQuery } from './StreamList.store'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import Icon from 'components/Icon'
import ListControl from 'components/ListControl'
import Loading from 'components/Loading'
import PostRow from './PostRow'
import { pictonBlue } from 'style/colors'
import styles from './StreamList.styles'

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

/* === COMPONENTS === */

export default function StreamList (props) {
  const {
    customView,
    streamType,
    forGroup,
    header,
    myHome,
    scrollRef,
    topicName
  } = props
  const navigation = useNavigation()
  const isFocused = useIsFocused()
  const [{ currentUser }] = useCurrentUser()
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
    forGroup,
    myHome,
    sortBy,
    timeframe,
    topicName
  })
  const [{ data, fetching }, refetchPosts] = useQuery(makeStreamQuery({ ...fetchPostParam, offset }))
  const postsQuerySet = data?.posts || data?.group?.posts
  const hasMore = postsQuerySet?.hasMore
  const posts = postsQuerySet?.items
  const postIds = posts?.map(p => p.id)

  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const [, resetGroupNewPostCount] = useMutation(resetGroupNewPostCountMutation)

  // TODO: URQL - Can this be simplified? Also, does this perhaps follow the same logic as
  // group(updateLastViewed: true) and could we combine this? Currently that extra
  // query arg for GroupDetailsQuery makes the URQL caching not merged, so it would be nice
  // to run it independently or make it a mutation, like this resetGroupNewPostCount
  useEffect(() => {
    if (fetchPostParam && isFocused && isEmpty(postIds) && hasMore !== false) {
      const slug = fetchPostParam.context

      if (
        forGroup?.id &&
        slug !== ALL_GROUP_ID &&
        slug !== PUBLIC_GROUP_ID &&
        slug !== MY_CONTEXT_ID &&
        !topicName &&
        sortBy === DEFAULT_SORT_BY_ID &&
        !fetchPostParam.filter
      ) {
        resetGroupNewPostCount({ id: forGroup?.id })
      }
    }
  }, [forGroup?.id, fetchPostParam?.filter, fetchPostParam?.context, hasMore, isFocused, postIds])

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

  if (!fetchPostParam) return null

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

  return (
    <View style={styles.container}>
      <FlatList
        ref={scrollRef}
        data={posts}
        renderItem={({ item }) => renderPostRow({ ...props, post: item })}
        onRefresh={refreshPosts}
        refreshing={false}
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
            {header}
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
                  )} options={DECISIONS_OPTIONS}
                />
              </View>
            )}
          </View>
        }
        ListFooterComponent={fetching ? <Loading style={styles.loading} /> : null}
      />
    </View>
  )
}

function renderPostRow ({
  post,
  fetchPostParam,
  forGroup
}) {
  return (
    <PostRow
      context={fetchPostParam?.context}
      post={post}
      forGroupId={forGroup?.id}
      showGroups={!forGroup?.id || isContextGroupSlug(forGroup?.slug)}
    />
  )
}
