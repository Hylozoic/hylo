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
    return messageThread.messages.items[0]
  }, [])

  return (
    <View style={styles.threadList}>
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
        renderItem={({ item, index }) => (
          item && <ThreadCard
            currentUser={currentUser}
            isLast={index === threads.length - 1}
            message={getLatestMessage(item)}
            onPress={() => showThread(item.id)}
            participants={item.participants}
            threadId={item.id}
            unreadCount={item.unreadCount}
          />
        )}
      />
      {fetching && (
        <Loading />
      )}
    </View>
  )
}
