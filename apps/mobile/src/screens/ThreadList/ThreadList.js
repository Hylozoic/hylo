import React, { useCallback, useEffect, useState } from 'react'
import { FlatList, TouchableOpacity, View, Text } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { useTranslation } from 'react-i18next'
import { useMutation, useQuery } from 'urql'
import updateUserSettingsMutation from 'graphql/mutations/updateUserSettingsMutation'
import messageThreadsQuery from 'graphql/queries/messageThreadsQuery'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import ThreadCard from 'components/ThreadCard'
import styles from './ThreadList.styles'
import Loading from 'components/Loading'

export default function ThreadList () {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const [{ currentUser }] = useCurrentUser()
  const [offset, setOffset] = useState(0)

  const [, updateUserSettings] = useMutation(updateUserSettingsMutation)
  const updateLastViewed = () => updateUserSettings({ changes: { settings: { lastViewedMessagesAt: new Date() } } })

  const [{ data, fetching }] = useQuery({ query: messageThreadsQuery, variables: { first: 10, offset } })
  const threads = data?.me?.messageThreads?.items
  const hasMore = data?.me?.messageThreads?.hasMore

  const fetchMoreThreads = () => {
    if (hasMore) {
      setOffset(threads.length)
    }
  }

  const refreshThreads = () => setOffset(0)

  const showThread = threadOrId => navigation.navigate('Thread', {
    id: threadOrId?.id || threadOrId
  })

  useEffect(() => {
    updateLastViewed()
  }, [])

  const getLatestMessage = useCallback(messageThread => {
    return messageThread.messages.items[0]
  }, [])

  return (
    <View style={styles.threadList}>
      {fetching && (
        <Loading />
      )}
      {!fetching && threads && !threads.length === 0 && (
        <Text style={styles.center}>{t('No active conversations')}</Text>
      )}
      <FlatList
        data={threads}
        keyExtractor={item => item.id.toString()}
        onEndReached={fetchMoreThreads}
        onRefresh={refreshThreads}
        refreshing={fetching}
        renderItem={({ item, index }) => (
          <MessageRow
            participants={item.participants}
            message={getLatestMessage(item)}
            threadId={item.id}
            unread={item.unread}
            currentUser={currentUser}
            isLast={index === threads.length - 1}
            showThread={showThread}
          />
        )}
      />
    </View>
  )
}

export function MessageRow ({ message, threadId, participants, currentUser, showThread, isLast, unread }) {
  return (
    <View>
      <TouchableOpacity onPress={() => showThread(threadId)}>
        <ThreadCard
          unread={unread}
          threadId={threadId}
          message={message}
          participants={participants}
          currentUser={currentUser}
          isLast={isLast}
        />
      </TouchableOpacity>
    </View>
  )
}
