import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Dimensions, Alert, TouchableOpacity, Text, View } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation, useIsFocused } from '@react-navigation/native'
import { FlashList } from '@shopify/flash-list'
import { useMutation, useQuery } from 'urql'
import { debounce } from 'lodash/fp'

import { makeStreamQuery } from 'screens/Stream/makeStreamQuery'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import Loading from 'components/Loading'
import ChatMessage from 'components/ChatMessage'
import ChatMessageInput from 'components/ChatMessageInput'
import createPostMutation from '@hylo/graphql/mutations/createPostMutation'
import fetchTopicFollowQuery from '@hylo/graphql/queries/fetchTopicFollowQuery'
import updateTopicFollowMutation from '@hylo/graphql/mutations/updateTopicFollowMutation'
import useReactOnEntity from 'hooks/useReactOnEntity'
import { deletePostMutation } from 'hooks/usePostActionSheet'

const DEFAULT_CHAT_TOPIC = 'general'
const PAGE_SIZE = 18

/**
 * Native chat room screen with real-time messaging
 */
export default function ChatRoom () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const isFocused = useIsFocused()

  const [{ currentUser }] = useCurrentUser()
  const [{ currentGroup, fetching: groupFetching }] = useCurrentGroup()
  const routeParams = useRouteParams()
  const { topicName: routeTopicName } = routeParams
  const [lastReadPostId, setLastReadPostId] = useState(null)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  
  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC
  const postListRef = useRef(null)
  const suppressAutoScrollRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [sending, setSending] = useState(false)


  // Fetch topicFollow to get lastReadPostId
  const [{ data: topicFollowData, fetching: topicFollowFetching }] = useQuery({
    query: fetchTopicFollowQuery,
    variables: {
      groupId: currentGroup?.id,
      topicName
    },
    pause: !currentGroup?.id
  })

  const topicFollow = useMemo(() => topicFollowData?.topicFollow, [topicFollowData])

  // Chat query parameters - load posts after lastReadPostId on initial load
  const streamQueryVariables = useMemo(() => {
    const newPostCount = topicFollow?.newPostCount || 0
    const lastReadPostId = topicFollow?.lastReadPostId || null
    console.log('newPostCount', newPostCount, newPostCount > 0)
    console.log('lastReadPostId', lastReadPostId)
    console.log('initialLoadComplete', initialLoadComplete, !initialLoadComplete)

    // When loading additional posts, only load 10 more
    let postsToLoad = 9

    let loadStrategy = 'recent' // default: load most recent posts
    if (!initialLoadComplete && lastReadPostId && newPostCount > 0) {
      console.log('loading from lastReadPostId')
      loadStrategy = 'fromLastRead'
      postsToLoad = 18 // Load enough to fill the screen on initial load (18 posts)
    }

    return {
      context: 'groups',
      slug: currentGroup?.slug,
      topic: topicName,
      sortBy: 'id',
      childPostInclusion: 'no',
      order: loadStrategy === 'fromLastRead' ? 'asc' : 'desc',
      first: postsToLoad,
      offset,
      filter: 'chat',
      // When loading from lastReadPostId, use cursor to start from that position
      ...(loadStrategy === 'fromLastRead' && {
        cursor: parseInt(lastReadPostId)
      })
    }
  }, [currentGroup?.slug, topicName, offset, initialLoadComplete, topicFollow?.lastReadPostId, topicFollow?.newPostCount])

  // Set initial lastReadPostId when topicFollow loads
  useEffect(() => {
    if (topicFollow?.lastReadPostId && !initialLoadComplete) {
      setLastReadPostId(topicFollow.lastReadPostId)
    }
  }, [topicFollow?.lastReadPostId, initialLoadComplete])

  console.log('bootstrapDone', bootstrapDone)
  console.log('paused?', !currentGroup?.slug || !topicFollow?.id || !bootstrapDone)

  // Fetch posts
  const [{ data, fetching, error }, refetchPosts] = useQuery({
    query: makeStreamQuery(streamQueryVariables).query,
    variables: streamQueryVariables,
    pause: !currentGroup?.slug,
    requestPolicy: 'cache-and-network'
  })

  // GraphQL mutations
  const [, createPost] = useMutation(createPostMutation)
  const [, deletePost] = useMutation(deletePostMutation)
  const [, updateTopicFollow] = useMutation(updateTopicFollowMutation)
  const { reactOnEntity, deleteReactionFromEntity } = useReactOnEntity()

  const postsQuerySet = useMemo(() => data?.group?.posts, [data])
  const hasMore = useMemo(() => postsQuerySet?.hasMore, [postsQuerySet])
  const [postsToDisplay, setPostsToDisplay] = useState([])
  const posts = useMemo(() => postsQuerySet?.items, [postsQuerySet])
  console.log('current posts', posts)

  // Accumulate pages locally to avoid blanking the list while loading more
  useEffect(() => {
    if (!posts) return
    if (!initialLoadComplete) {
      console.log('did initial load we think, setting postsToDisplay', posts)
      setPostsToDisplay(posts)
      if (!initialLoadComplete) {
        setInitialLoadComplete(true)
      }
      return
    }
    // Merge unique by id, appending older items to the end
    setPostsToDisplay(prev => {
      if (!prev?.length) return posts
      const existingIds = new Set(prev.map(p => p.id))
      const appended = posts.filter(p => !existingIds.has(p.id))
      return appended.length ? [...prev, ...appended] : prev
    })
  }, [posts, offset])

  const [loadingMore, setLoadingMore] = useState(false)
  const [dayMarker, setDayMarker] = useState('')

  const handleSendPost = useCallback(async (postText) => {
    if (!postText.trim() || !currentGroup?.id || sending) return

    setSending(true)
    try {
      await createPost({
        type: 'chat',
        details: postText,
        groupIds: [currentGroup.id],
        topicNames: [topicName]
      })

      // Reset pagination and refetch newest page to include the new post
      setOffset(0)
      refetchPosts({ requestPolicy: 'network-only' })

      // With inverted list, offset 0 is the visual bottom
      setTimeout(() => {
        postListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 100)
    } catch (error) {
      console.error('Error sending post:', error)
      Alert.alert(t('Error'), t('Failed to send post. Please try again.'))
    } finally {
      setSending(false)
    }
  }, [currentGroup?.id, topicName, createPost, refetchPosts, sending, t])

  const handleAddReaction = useCallback(async (postId, emojiData) => {
    try {
      await reactOnEntity('post', postId, emojiData.colons)
      refetchPosts({ requestPolicy: 'cache-and-network' })
    } catch (error) {
      console.error('Error adding reaction:', error)
    }
  }, [reactOnEntity, refetchPosts])

  const handleRemoveReaction = useCallback(async (postId, emojiFull) => {
    try {
      await deleteReactionFromEntity('post', postId, emojiFull)
      refetchPosts({ requestPolicy: 'cache-and-network' })
    } catch (error) {
      console.error('Error removing reaction:', error)
    }
  }, [deleteReactionFromEntity, refetchPosts])

  const handleFlagPost = useCallback((postId) => {
    // TODO: Implement flag post functionality
    Alert.alert(t('Flag Post'), t('This feature will be implemented soon.'))
  }, [t])

  const handleRemovePost = useCallback(async (postId) => {
    Alert.alert(
      t('Remove Post'),
      t('Are you sure you want to remove this post?'),
      [
        { text: t('Cancel'), style: 'cancel' },
        {
          text: t('Remove'),
          style: 'destructive',
          onPress: async () => {
            try {
              await deletePost({ id: postId })
              refetchPosts({ requestPolicy: 'network-only' })
            } catch (error) {
              console.error('Error deleting post:', error)
              Alert.alert(t('Error'), t('Failed to remove post.'))
            }
          }
        }
      ]
    )
  }, [deletePost, refetchPosts, t])

  const handleLoadMore = useCallback(() => {
    if (loadingMore || fetching) return
    if (hasMore) {
      suppressAutoScrollRef.current = true
      setLoadingMore(true)
      setOffset(postsToDisplay.length)
    }
  }, [hasMore, fetching, loadingMore, postsToDisplay.length])

  // Reset loadingMore once a new page has been merged
  useEffect(() => {
    if (loadingMore && posts?.length) {
      setLoadingMore(false)
    }
  }, [posts?.length, loadingMore])

  // Determine if we should show "New Posts" indicator
  const shouldShowNewPostsIndicator = useCallback((post, index) => {
    if (!lastReadPostId || !initialLoadComplete) return false

    // In inverted list: index 0 = newest, higher index = older
    // Show indicator if this is the first unread post when going from newer to older
    // (post is newer than lastReadPostId and next post (older) is read or doesn't exist)
    const olderPost = index < postsToDisplay.length - 1 ? postsToDisplay[index + 1] : null
    const isPostUnread = parseInt(post.id) > parseInt(lastReadPostId)
    const isOlderPostRead = !olderPost || parseInt(olderPost.id) <= parseInt(lastReadPostId)

    return isPostUnread && isOlderPostRead
  }, [lastReadPostId, postsToDisplay, initialLoadComplete])

  const renderPost = useCallback(({ item: post, index }) => {
    // In inverted list: we need to swap previous/next for ChatMessage component
    // ChatMessage expects previousPost to be the chronologically earlier post
    // and nextPost to be the chronologically later post
    const previousPost = index < postsToDisplay.length - 1 ? postsToDisplay[index + 1] : null // Older post
    const nextPost = index > 0 ? postsToDisplay[index - 1] : null // Newer post
    const showNewPostsIndicator = shouldShowNewPostsIndicator(post, index)

    return (
      <>
        {showNewPostsIndicator && (
          <View style={styles.newPostsIndicator}>
            <View style={styles.newPostsLine} />
            <Text style={styles.newPostsText}>New Posts</Text>
            <View style={styles.newPostsLine} />
          </View>
        )}
        <ChatMessage
          post={post}
          currentUser={currentUser}
          previousPost={previousPost}
          nextPost={nextPost}
          onAddReaction={handleAddReaction}
          onRemoveReaction={handleRemoveReaction}
          onFlagPost={handleFlagPost}
          onRemovePost={handleRemovePost}
          onPress={() => {
            // TODO: Handle post press (show details, etc.)
          }}
        />
      </>
    )
  }, [postsToDisplay, currentUser, handleAddReaction, handleRemoveReaction, handleFlagPost, handleRemovePost, shouldShowNewPostsIndicator])

  const keyExtractor = useCallback((item) => item.id, [])

  // Auto-scroll to bottom when new messages arrive and user is at/near bottom
  const [isNearBottom, setIsNearBottom] = useState(true)
  // Debounced updater that operates on plain values, not the pooled event
  const debouncedScrollUpdate = useMemo(
    () =>
      debounce(300, (payload) => {
        if (!payload) return
        const { contentOffset, contentSize, layoutMeasurement } = payload
        if (!contentSize || !layoutMeasurement || !contentOffset) return
        // In inverted lists, y=0 is the visual bottom. Consider near bottom if
        // the current offset is within a small threshold from 0.
        const offsetY = contentOffset?.y ?? 0
        const nearBottom = offsetY < 48
        setIsNearBottom(nearBottom)
        if (nearBottom) suppressAutoScrollRef.current = false
        // If we've paginated (offset>0) and user comes back to bottom, reset to newest
        if (nearBottom && offset !== 0 && !loadingMore && !fetching) {
          setOffset(0)
        }
      }),
    [offset, loadingMore, fetching]
  )

  // Synchronous onScroll handler to extract values before React pools the event
  const onScroll = useCallback((event) => {
    const { contentOffset, contentSize, layoutMeasurement } = event?.nativeEvent || {}
    debouncedScrollUpdate({ contentOffset, contentSize, layoutMeasurement })
  }, [debouncedScrollUpdate])

  // Debounced function to update lastReadPostId
  const updateLastReadPost = useMemo(
    () => debounce(500, (postId) => {
      if (!topicFollow?.id || !postId) return
      if (!lastReadPostId || parseInt(postId) > parseInt(lastReadPostId)) {
        setLastReadPostId(postId)
        updateTopicFollow({
          id: topicFollow.id,
          data: { lastReadPostId: postId }
        }).catch(error => {
          console.error('Error updating last read post:', error)
        })
      }
    }),
    [topicFollow?.id, lastReadPostId, updateTopicFollow]
  )

  // Update floating day marker and track last read post based on visible posts
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (!viewableItems?.length) return

    let topMost = null
    let bottomMost = null

    for (const v of viewableItems) {
      if (!v?.isViewable) continue
      if (topMost == null || (typeof v.index === 'number' && v.index > topMost.index)) {
        topMost = { index: v.index, item: v.item }
      }
      if (bottomMost == null || (typeof v.index === 'number' && v.index < bottomMost.index)) {
        console.log('updating bottomMost', v.index, v.item.id)
        bottomMost = { index: v.index, item: v.item }
      }
    }

    // Update day marker
    const createdAt = topMost?.item?.createdAt
    if (createdAt) {
      const label = (() => {
        const d = new Date(createdAt)
        const now = new Date()
        const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())
        const diffDays = Math.floor((startOfDay(now) - startOfDay(d)) / 86400000)
        if (diffDays === 0) return 'Today'
        if (diffDays === 1) return 'Yesterday'
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
      })()
      setDayMarker(label)
    }

    // Update last read post ID to the bottom-most visible post
    if (initialLoadComplete && bottomMost?.item?.id) {
      updateLastReadPost(bottomMost.item.id)
    }
  }, [updateLastReadPost, initialLoadComplete])

  // Scroll to bottom when posts change and user is near bottom
  useEffect(() => {
    // Only auto-scroll when we're on the newest page (offset === 0) and user is near bottom
    if (offset === 0 && messages.length > 0 && isNearBottom && !loadingMore && !suppressAutoScrollRef.current) {
      setTimeout(() => {
        messageListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 100)
    }
  }, [messages.length, isNearBottom, offset, loadingMore])

  // Set navigation title
  useEffect(() => {
    navigation.setOptions({
      title: `#${topicName}`
    })
  }, [navigation, topicName])

  // Refetch when screen comes into focus for latest posts
  useEffect(() => {
    if (isFocused && currentGroup?.slug) {
      refetchPosts({ requestPolicy: 'cache-and-network' })
    }
  }, [isFocused, currentGroup?.slug, refetchPosts])

  if (groupFetching || !currentGroup || topicFollowFetching) {
    return <Loading />
  }

  if (error) {
    console.error('ChatRoom error:', error)
  }

  return (
    <KeyboardFriendlyView style={styles.container}>
      <FlashList
        ref={postListRef}
        data={postsToDisplay}
        inverted
        estimatedItemSize={80}
        estimatedListSize={Dimensions.get('screen')}
        renderItem={renderPost}
        keyExtractor={keyExtractor}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        refreshing={fetching}
        onRefresh={() => {
          setOffset(0)
          refetchPosts({ requestPolicy: 'network-only' })
        }}
        // In inverted mode we don't need an initial scroll
        ListFooterComponent={fetching || loadingMore ? <Loading style={styles.loadingFooter} /> : null}
        contentContainerStyle={styles.postsList}
        showsVerticalScrollIndicator={false}
        // No maintainVisibleContentPosition in inverted mode to avoid layout issues
      />

      {dayMarker
        ? (
          <View style={styles.dayMarkerContainer} pointerEvents='none'>
            <Text style={styles.dayMarkerText}>{dayMarker}</Text>
          </View>
          )
        : null}

      {!isNearBottom && (
        <TouchableOpacity
          onPress={() => postListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={styles.scrollToBottomButton}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollToBottomButtonText}>↓</Text>
        </TouchableOpacity>
      )}

      <ChatMessageInput
        onSend={handleSendPost}
        disabled={sending}
        placeholder={t('Post to #{{topicName}}', { topicName })}
      />
    </KeyboardFriendlyView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  postsList: {
    paddingVertical: 8
  },
  loadingFooter: {
    paddingVertical: 16
  },
  dayMarkerContainer: {
    position: 'absolute',
    top: 8,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6
  },
  dayMarkerText: {
    color: '#fff',
    fontSize: 12,
    fontFamily: 'Circular-Bold'
  },
  scrollToBottomButton: {
    position: 'absolute',
    right: 16,
    bottom: 88,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    // iOS shadow
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.5,
    // Android shadow
    elevation: 3
  },
  scrollToBottomButtonText: {
    color: '#fff',
    fontSize: 20,
    lineHeight: 20
  },
  newPostsIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
    marginHorizontal: 16
  },
  newPostsLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#ef4444' // red-500
  },
  newPostsText: {
    color: '#ef4444', // red-500
    fontSize: 12,
    fontFamily: 'Circular-Bold',
    marginHorizontal: 12,
    textTransform: 'uppercase'
  }
})
