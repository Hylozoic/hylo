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

  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC
  const messageListRef = useRef(null)
  const suppressAutoScrollRef = useRef(false)
  const [offset, setOffset] = useState(0)
  const [sending, setSending] = useState(false)

  // Chat query parameters - focused on recent messages in reverse chronological order
  const streamQueryVariables = useMemo(() => ({
    context: 'groups',
    slug: currentGroup?.slug,
    topic: topicName,
    sortBy: 'created',
    order: 'desc', // Most recent first
    first: PAGE_SIZE,
    offset,
    filter: 'chat'
  }), [currentGroup?.slug, topicName, offset])

  // Fetch posts (chat messages)
  const [{ data, fetching, error }, refetchPosts] = useQuery({
    query: makeStreamQuery(streamQueryVariables).query,
    variables: streamQueryVariables,
    pause: !currentGroup?.slug,
    requestPolicy: 'cache-and-network'
  })

  // GraphQL mutations
  const [, createPost] = useMutation(createPostMutation)
  const [, deletePost] = useMutation(deletePostMutation)
  const { reactOnEntity, deleteReactionFromEntity } = useReactOnEntity()

  const postsQuerySet = useMemo(() => data?.group?.posts, [data])
  const hasMore = useMemo(() => postsQuerySet?.hasMore, [postsQuerySet])
  const [messages, setMessages] = useState([])
  const posts = useMemo(() => postsQuerySet?.items || [], [postsQuerySet])

  // Accumulate pages locally to avoid blanking the list while loading more
  useEffect(() => {
    if (!posts) return
    if (offset === 0) {
      setMessages(posts)
      return
    }
    // Merge unique by id, appending older items to the end
    setMessages(prev => {
      if (!prev?.length) return posts
      const existingIds = new Set(prev.map(p => p.id))
      const appended = posts.filter(p => !existingIds.has(p.id))
      return appended.length ? [...prev, ...appended] : prev
    })
  }, [posts, offset])

  const [loadingMore, setLoadingMore] = useState(false)
  const [dayMarker, setDayMarker] = useState('')

  const handleSendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || !currentGroup?.id || sending) return

    setSending(true)
    try {
      await createPost({
        type: 'chat',
        details: messageText,
        groupIds: [currentGroup.id],
        topicNames: [topicName]
      })

      // Reset pagination and refetch newest page to include the new post
      setOffset(0)
      refetchPosts({ requestPolicy: 'network-only' })

      // With inverted list, offset 0 is the visual bottom
      setTimeout(() => {
        messageListRef.current?.scrollToOffset({ offset: 0, animated: true })
      }, 100)
    } catch (error) {
      console.error('Error sending message:', error)
      Alert.alert(t('Error'), t('Failed to send message. Please try again.'))
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
      t('Remove Message'),
      t('Are you sure you want to remove this message?'),
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
              Alert.alert(t('Error'), t('Failed to remove message.'))
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
      setOffset(messages.length)
    }
  }, [hasMore, fetching, loadingMore, messages.length])

  // Reset loadingMore once a new page has been merged
  useEffect(() => {
    if (loadingMore && posts?.length) {
      setLoadingMore(false)
    }
  }, [posts?.length, loadingMore])

  const renderMessage = useCallback(({ item: post, index }) => {
    const previousPost = index > 0 ? messages[index - 1] : null
    const nextPost = index < messages.length - 1 ? messages[index + 1] : null

    return (
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
          // TODO: Handle message press (show details, etc.)
        }}
      />
    )
  }, [messages, currentUser, handleAddReaction, handleRemoveReaction, handleFlagPost, handleRemovePost])

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

  // Update floating day marker based on the top-most visible message
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    if (!viewableItems?.length) return
    let topMost = null
    for (const v of viewableItems) {
      if (!v?.isViewable) continue
      if (topMost == null || (typeof v.index === 'number' && v.index > topMost.index)) {
        topMost = { index: v.index, item: v.item }
      }
    }
    const createdAt = topMost?.item?.createdAt
    if (!createdAt) return
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
  }, [])

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

  // Refetch when screen comes into focus for latest messages
  useEffect(() => {
    if (isFocused && currentGroup?.slug) {
      refetchPosts({ requestPolicy: 'cache-and-network' })
    }
  }, [isFocused, currentGroup?.slug, refetchPosts])

  if (groupFetching || !currentGroup) {
    return <Loading />
  }

  if (error) {
    console.error('ChatRoom error:', error)
  }

  return (
    <KeyboardFriendlyView style={styles.container}>
      <FlashList
        ref={messageListRef}
        data={messages}
        inverted
        estimatedItemSize={80}
        estimatedListSize={Dimensions.get('screen')}
        renderItem={renderMessage}
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
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        // No maintainVisibleContentPosition in inverted mode to avoid layout issues
      />

      {dayMarker ? (
        <View style={styles.dayMarkerContainer} pointerEvents='none'>
          <Text style={styles.dayMarkerText}>{dayMarker}</Text>
        </View>
      ) : null}

      {!isNearBottom && (
        <TouchableOpacity
          onPress={() => messageListRef.current?.scrollToOffset({ offset: 0, animated: true })}
          style={styles.scrollToBottomButton}
          activeOpacity={0.8}
        >
          <Text style={styles.scrollToBottomButtonText}>↓</Text>
        </TouchableOpacity>
      )}

      <ChatMessageInput
        onSend={handleSendMessage}
        disabled={sending}
        placeholder={t('Message #{{topicName}}', { topicName })}
      />
    </KeyboardFriendlyView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff'
  },
  messagesList: {
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
  }
})
