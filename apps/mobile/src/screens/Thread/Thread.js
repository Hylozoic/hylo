import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList, StyleSheet } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { useDispatch } from 'react-redux'
import { gql, useMutation, useQuery, useSubscription } from 'urql'
import { debounce } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import messageThreadMessagesQuery from 'graphql/queries/messageThreadMessagesQuery'
import createMessageMutation from 'graphql/mutations/createMessageMutation'
import useCurrentUser from 'urql-shared/hooks/useCurrentUser'
import useRouteParams from 'hooks/useRouteParams'
import Loading from 'components/Loading'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import NotificationOverlay from 'components/NotificationOverlay'
import MessageCard from 'components/MessageCard'
import MessageInput from 'components/MessageInput'
import PeopleTyping from 'components/PeopleTyping'
import ThreadHeaderTitle from './ThreadHeaderTitle'
import { rhino10, alabaster, mercury } from 'style/colors'

const BOTTOM_THRESHOLD = 10
const MESSAGE_PAGE_SIZE = 20
const BATCH_LIMIT_MS = 2 * 60 * 1000 // 2 minutes in milliseconds

export const UPDATE_THREAD_READ_TIME = 'Thread/UPDATE_THREAD_READ_TIME'

export function updateThreadReadTimeAction(id) {
  return {
    type: UPDATE_THREAD_READ_TIME,
    payload: { api: { path: `/noo/post/${id}/update-last-read`, method: 'POST' } },
    meta: { id }
  }
}

export default function Thread() {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const messageListRef = useRef()
  const peopleTypingRef = useRef()
  const [{ currentUser }] = useCurrentUser()
  const { id: threadId } = useRouteParams()

  const [, createMessage] = useMutation(createMessageMutation)
  const [cursor, setCursor] = useState(null)
  const [{ data, fetching }] = useQuery({
    query: messageThreadMessagesQuery,
    variables: { id: threadId, first: MESSAGE_PAGE_SIZE, cursor }
  })

  const messages = data?.messageThread?.messages?.items || []
  const hasMore = data?.messageThread?.messages?.hasMore

  // Not currently used, but once we have subscription applied we can turn it back on
  const [newMessages, setNewMessages] = useState()
  const [yOffset, setYOffset] = useState(0)
  const atBottom = useMemo(() => yOffset < BOTTOM_THRESHOLD, [yOffset])  
  const markAsRead = debounce(1000, () => {
    dispatch(updateThreadReadTimeAction(threadId))
  })

  const isWithinBatchLimit = (timestamp1, timestamp2) => {
    return Math.abs(new Date(timestamp1) - new Date(timestamp2)) <= BATCH_LIMIT_MS
  }

  const refineMessages = (messages) =>
    messages.map((msg, i, arr) => {
      const prev = arr[i + 1]
      const next = arr[i - 1]

      const suppressCreator = prev && msg.creator.id === prev.creator.id
      const suppressDate =
        next &&
        msg.creator.id === next.creator.id &&
        isWithinBatchLimit(next.createdAt, msg.createdAt)

      return {
        ...msg,
        suppressCreator,
        suppressDate
      }
    })

  const fetchMore = () => {
    if (messages && hasMore) {
      setCursor(messages[messages.length - 1].id)
    }
  }

  const handleScroll = ({ nativeEvent: { contentOffset } }) => {
    setYOffset(contentOffset.y)
    if (contentOffset.y < BOTTOM_THRESHOLD) markAsRead()
  }

  const handleScrollToBottom = () => {
    messageListRef?.current?.scrollToOffset({ offset: 0 })
  }

  const handleSendTyping = () => peopleTypingRef?.current?.sendTyping()

  const handleSubmit = (text) => {
    createMessage({
      messageThreadId: threadId,
      text: TextHelpers.markdown(text)
    })
  }

  const setHeader = () => {
    navigation.setOptions({
      headerTitleStyle: { color: rhino10 },
      headerTitle: () => (
        <ThreadHeaderTitle thread={data?.messageThread} currentUserId={currentUser?.id} />
      )
    })
  }

  useEffect(() => {
    setHeader()
    markAsRead()
  }, [data?.messageThread, currentUser?.id])

  useEffect(() => {
    if (messages.length && atBottom) {
      setNewMessages(1)
    }
  }, [messages, atBottom])

  const renderItem = ({ item }) => (
    <MessageCard message={item} />
  )

  return (
    <KeyboardFriendlyView style={styles.container}>
      {fetching && <Loading />}
      <FlatList
        style={styles.messageList}
        data={refineMessages(messages)}
        inverted
        keyExtractor={(item) => item.id}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        ref={messageListRef}
        renderItem={renderItem}
      />
      {!!(newMessages && !atBottom) && (
        <NotificationOverlay
          position='bottom'
          message={t('New messages')}
          onPress={handleScrollToBottom}
        />
      )}
      <MessageInput
        blurOnSubmit={false}
        multiline
        sendIsTyping={handleSendTyping}
        onSubmit={handleSubmit}
        placeholder={t('Write something')}
      />
      <PeopleTyping messageThreadId={threadId} ref={peopleTypingRef} />
    </KeyboardFriendlyView>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: alabaster // flag-messages-background-color
  },
  input: {
    fontSize: 14,
    fontFamily: 'Circular-Book',
    paddingBottom: 4,
    borderRadius: 4,
    shadowColor: mercury,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 15,
    shadowOpacity: 0.1,
    margin: 8,
    paddingHorizontal: 7,
    paddingVertical: 12,

    // Android-only
    elevation: 1
  },
  messageList: {}
})
