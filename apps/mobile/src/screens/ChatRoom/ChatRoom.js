import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { StyleSheet, Dimensions, Alert } from 'react-native'
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
const PAGE_SIZE = 25

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
    // Only show discussion posts (chat messages) - exclude events, requests, etc.
    filter: 'discussion'
  }), [currentGroup?.slug, topicName, offset])

  // Fetch posts (chat messages)
  const [{ data, fetching, error }, refetchPosts] = useQuery({
    query: makeStreamQuery(streamQueryVariables).query,
    variables: streamQueryVariables,
    pause: !currentGroup?.slug
  })

  // GraphQL mutations
  const [, createPost] = useMutation(createPostMutation)
  const [, deletePost] = useMutation(deletePostMutation)
  const { reactOnEntity, deleteReactionFromEntity } = useReactOnEntity()

  const postsQuerySet = useMemo(() => data?.group?.posts, [data])
  const hasMore = useMemo(() => postsQuerySet?.hasMore, [postsQuerySet])
  const posts = useMemo(() => {
    // Reverse the posts to show oldest at top, newest at bottom (like typical chat)
    return postsQuerySet?.items ? [...postsQuerySet.items].reverse() : []
  }, [postsQuerySet])

  const handleSendMessage = useCallback(async (messageText) => {
    if (!messageText.trim() || !currentGroup?.id || sending) return

    setSending(true)
    try {
      await createPost({
        type: 'discussion',
        details: messageText,
        groupIds: [currentGroup.id],
        topicNames: [topicName]
      })

      // Refetch to get the new message
      refetchPosts({ requestPolicy: 'network-only' })

      // Scroll to bottom to show new message
      setTimeout(() => {
        messageListRef.current?.scrollToEnd({ animated: true })
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
    if (hasMore && !fetching) {
      setOffset(posts.length)
    }
  }, [hasMore, fetching, posts.length])

  const renderMessage = useCallback(({ item: post, index }) => {
    const previousPost = index > 0 ? posts[index - 1] : null
    const nextPost = index < posts.length - 1 ? posts[index + 1] : null

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
  }, [posts, currentUser, handleAddReaction, handleRemoveReaction, handleFlagPost, handleRemovePost])

  const keyExtractor = useCallback((item) => item.id, [])

  // Auto-scroll to bottom when new messages arrive and user is at/near bottom
  const [isNearBottom, setIsNearBottom] = useState(true)
  const handleScroll = useMemo(() =>
    debounce(300, (info) => {
      const { contentOffset, contentSize, layoutMeasurement } = info
      const distanceFromBottom = contentSize.height - (contentOffset.y + layoutMeasurement.height)
      setIsNearBottom(distanceFromBottom < 100)
    }),
  []
  )

  // Scroll to bottom when posts change and user is near bottom
  useEffect(() => {
    if (posts.length > 0 && isNearBottom) {
      setTimeout(() => {
        messageListRef.current?.scrollToEnd({ animated: true })
      }, 100)
    }
  }, [posts.length, isNearBottom])

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
        data={posts}
        estimatedItemSize={80}
        estimatedListSize={Dimensions.get('screen')}
        renderItem={renderMessage}
        keyExtractor={keyExtractor}
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.1}
        onScroll={handleScroll}
        refreshing={fetching}
        onRefresh={() => {
          setOffset(0)
          refetchPosts({ requestPolicy: 'network-only' })
        }}
        ListFooterComponent={fetching ? <Loading style={styles.loadingFooter} /> : null}
        contentContainerStyle={styles.messagesList}
        showsVerticalScrollIndicator={false}
        // Keep messages at bottom initially
        maintainVisibleContentPosition={{
          minIndexForVisible: 0,
          autoscrollToTopThreshold: 10
        }}
      />

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
  }
})
