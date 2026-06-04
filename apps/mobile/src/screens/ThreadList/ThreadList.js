// DEPRECATED: This native screen is no longer used.
// All functionality is now handled by PrimaryWebView displaying the web app.
// Kept for reference only.

import React, { useCallback, useState } from 'react'
import { View, Text, Dimensions } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'urql'
import { v4 as uuidv4 } from 'uuid'
import updateUserSettingsMutation from '@hylo/graphql/mutations/updateUserSettingsMutation'
import messageThreadsQuery from '@hylo/graphql/queries/messageThreadsQuery'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
import Loading from 'components/Loading'
import ThreadCard from 'components/ThreadCard'
import UrqlCacheDiagnostic from 'components/ThreadCard/UrqlCacheDiagnostic'
import styles from './ThreadList.styles'

export default function ThreadList () {
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [offset, setOffset] = useState(0)
  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const updateLastViewed = () => updateUserSettings({ changes: { settings: { lastViewedMessagesAt: new Date() } } })

  const [{ data, fetching }, fetchThreads] = useQuery({
    query: messageThreadsQuery,
    variables: { first: 10, offset },
    requestPolicy: 'cache-and-network'
  })
  const threads = data?.me?.messageThreads?.items
  const hasMore = data?.me?.messageThreads?.hasMore

  useFocusEffect(
    useCallback(() => {
      fetchThreads()
      updateLastViewed()
    }, [])
  )

  const fetchMoreThreads = () => {
    if (hasMore) setOffset(threads.length)
  }

  const refreshThreads = () => {
    setOffset(0)
    fetchThreads({ requestPolicy: 'network-only' })
  }

  const showThread = threadOrId => navigation.navigate('Thread', {
    id: threadOrId?.id || threadOrId
  })

  const getLatestMessage = useCallback(messageThread => {
    if (!messageThread?.messages?.items || messageThread.messages.items.length === 0) {
      if (process.env.NODE_ENV === 'development') {
        console.warn('ThreadList: Missing messages data for thread:', messageThread?.id)
      }
      return null
    }
    return messageThread.messages.items[0]
  }, [])

  return (
    <View style={styles.threadList}>
      <UrqlCacheDiagnostic />
      {!fetching && threads && !threads.length === 0 && (
        <Text style={styles.center}>{t('No active conversations')}</Text>
      )}
      <FlashList
        data={threads}
        estimatedItemSize={93}
        estimatedListSize={Dimensions.get('screen')}
        keyExtractor={item => item?.id?.toString() || uuidv4()}
        onEndReached={fetchMoreThreads}
        onRefresh={refreshThreads}
        refreshing={fetching}
        renderItem={({ item, index }) => {
          if (!item) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('ThreadList: Null thread item at index:', index)
            }
            return null
          }
          
          const latestMessage = getLatestMessage(item)
          if (!latestMessage) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('ThreadList: No latest message for thread:', item.id)
            }
            return null
          }
          
          return (
            <ThreadCard
              currentUser={currentUser}
              isLast={index === threads.length - 1}
              message={latestMessage}
              onPress={() => showThread(item.id)}
              participants={item.participants}
              threadId={item.id}
              unreadCount={item.unreadCount}
            />
          )
        }}
      />
      {fetching && (
        <Loading />
      )}
    </View>
  )
}
