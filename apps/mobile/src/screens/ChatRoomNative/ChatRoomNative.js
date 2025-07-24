import React, { useCallback, useMemo, useRef, useState } from 'react'
import { Dimensions, StyleSheet, View, Text } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import useCurrentGroup from '@hylo/hooks/useCurrentGroup'
import useRouteParams from 'hooks/useRouteParams'
import useTopicFollow from '@hylo/hooks/useTopicFollow'
import useChatPosts from '@hylo/hooks/useChatPosts'
import Loading from 'components/Loading'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import PostCard from 'components/PostCard'
import { twBackground } from 'style/colors'

const BOTTOM_THRESHOLD = 10
const POSTS_PAGE_SIZE = 20
export const DEFAULT_CHAT_TOPIC = 'general'

export default function ChatRoomNative () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const messageListRef = useRef()
  const [{ currentGroup }] = useCurrentGroup()
  const { topicName: routeTopicName } = useRouteParams()
  const topicName = routeTopicName || DEFAULT_CHAT_TOPIC

  // State for pagination
  const [cursor, setCursor] = useState(null)
  const [yOffset, setYOffset] = useState(0)
  const atBottom = useMemo(() => yOffset < BOTTOM_THRESHOLD, [yOffset])

  // Fetch topic follow data
  const [topicFollow, { fetching: topicFollowFetching }] = useTopicFollow({
    groupId: currentGroup?.id,
    topicName
  })

  // Fetch chat posts
  const chatPostsParams = {
    groupSlug: currentGroup?.slug,
    topicId: topicFollow?.topic?.id,
    cursor,
    first: POSTS_PAGE_SIZE,
    order: 'desc' // Most recent posts first, then inverted display
  }
  
  console.log('Chat Posts Query Params:', chatPostsParams)
  
  const { posts, hasMore, fetching, reQuery } = useChatPosts({
    ...chatPostsParams,
    debugNoFilter: true // TODO: Test without chat filter to see if posts exist
  })

  const fetchMore = useCallback(() => {
    if (!fetching && hasMore && posts?.length) {
      setCursor(posts[posts.length - 1].id)
    }
  }, [fetching, hasMore, posts])

  const handleScroll = ({ nativeEvent: { contentOffset } }) => {
    setYOffset(contentOffset.y)
  }

  const handleScrollToBottom = () => {
    messageListRef?.current?.scrollToOffset({ offset: 0 })
  }

  const handleRefresh = async () => {
    setCursor(null)
    reQuery({ requestPolicy: 'network-only' })
  }

  // Set navigation header
  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitle: `#${topicName}`,
        headerStyle: { backgroundColor: twBackground }
      })
    }, [topicName])
  )

  // Debug logging
  console.log('ChatRoomNative Debug:', {
    groupSlug: currentGroup?.slug,
    groupId: currentGroup?.id,
    topicName,
    topicFollowFetching,
    topicFollow: topicFollow ? {
      id: topicFollow.id,
      topicId: topicFollow.topic?.id,
      topicName: topicFollow.topic?.name
    } : null,
    postsLength: posts?.length,
    fetching,
    hasMore,
    cursor
  })

  // Show loading if we don't have essential data
  if (topicFollowFetching || !topicFollow?.topic?.id) {
    return (
      <KeyboardFriendlyView style={styles.container}>
        <Loading />
        <Text style={styles.debugText}>
          Loading... Group: {currentGroup?.slug}, Topic: {topicName}
        </Text>
      </KeyboardFriendlyView>
    )
  }

  const renderItem = ({ item }) => (
    <View style={styles.postContainer}>
      <PostCard
        post={item}
        forGroupId={currentGroup?.id}
        showGroups={false}
      />
    </View>
  )

  // Removed renderListEmpty - now handled outside FlashList to avoid inversion issues

  // Show empty state if no posts and not fetching
  const showEmptyState = !fetching && posts?.length === 0

  return (
    <KeyboardFriendlyView style={styles.container}>
      {/* Debug info */}
      <View style={styles.debugContainer}>
        <Text style={styles.debugText}>
          Posts: {posts?.length || 0} | Fetching: {fetching ? 'Yes' : 'No'} | HasMore: {hasMore ? 'Yes' : 'No'}
        </Text>
        <Text style={styles.debugText}>
          Topic: {topicFollow?.topic?.name} | Group: {currentGroup?.name}
        </Text>
      </View>

      <View style={styles.messageListContainer}>
        {showEmptyState ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {t('No messages yet. Start the conversation!')}
            </Text>
          </View>
        ) : (
          <FlashList
            contentContainerStyle={styles.messageListContent}
            data={posts}
            estimatedListSize={Dimensions.get('screen')}
            estimatedItemSize={200}
            inverted // Messages appear from bottom like a chat
            keyExtractor={(item) => item.id}
            keyboardDismissMode='on-drag'
            keyboardShouldPersistTaps='handled'
            refreshing={fetching}
            onRefresh={handleRefresh}
            onEndReached={fetchMore}
            onEndReachedThreshold={0.3}
            onScroll={handleScroll}
            ref={messageListRef}
            renderItem={renderItem}
            ListFooterComponent={fetching && <Loading />}
          />
        )}
      </View>
      
      {/* TODO: Add chat input component here */}
      <View style={styles.chatInputPlaceholder}>
        <Text style={styles.placeholderText}>
          {t('Chat input component will go here')}
        </Text>
      </View>
    </KeyboardFriendlyView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: twBackground
  },
  debugContainer: {
    backgroundColor: '#ffffcc',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd'
  },
  debugText: {
    fontSize: 10,
    color: '#333',
    fontFamily: 'monospace'
  },
  messageListContainer: {
    flex: 1
  },
  messageListContent: {
    paddingHorizontal: 16
  },
  postContainer: {
    marginVertical: 4
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 40
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center'
  },
  chatInputPlaceholder: {
    height: 60,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#ddd'
  },
  placeholderText: {
    color: '#999',
    fontSize: 14
  }
}) 