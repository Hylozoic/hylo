import React, { useEffect, useMemo, useRef, useState } from 'react'
import { FlatList } from 'react-native'
import { useTranslation } from 'react-i18next'
import { useNavigation } from '@react-navigation/native'
import { useDispatch, useSelector } from 'react-redux'
import { useMutation, useQuery } from 'urql'
import { debounce } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { getSocket, sendIsTyping as providedSendIsTyping } from 'util/websockets'
import messageThreadMessagesQuery from 'graphql/queries/messageThreadMessagesQuery'
import createMessageMutation from 'graphql/mutations/createMessageMutation'
import confirmNavigate from 'util/confirmNavigate'
import useCurrentUser from 'hooks/useCurrentUser'
import useRouteParams from 'hooks/useRouteParams'
import Loading from 'components/Loading'
import KeyboardFriendlyView from 'components/KeyboardFriendlyView'
import MessageCard from 'components/MessageCard'
import MessageInput from 'components/MessageInput'
import NotificationOverlay from 'components/NotificationOverlay'
import PeopleTyping from 'components/PeopleTyping'
import SocketSubscriber from 'components/SocketSubscriber'
import ThreadHeaderTitle from './ThreadHeaderTitle'
import styles from './Thread.styles'
import { rhino10 } from 'style/colors'

const BOTTOM_THRESHOLD = 10
const MESSAGE_PAGE_SIZE = 20

export const UPDATE_THREAD_READ_TIME = 'Thread/UPDATE_THREAD_READ_TIME'

export function updateThreadReadTimeAction (id) {
  return {
    type: UPDATE_THREAD_READ_TIME,
    payload: { api: { path: `/noo/post/${id}/update-last-read`, method: 'POST' } },
    meta: { id }
  }
}
export default function Thread (props) {
  const { t } = useTranslation()
  const navigation = useNavigation()
  const dispatch = useDispatch()
  const isConnected = useSelector(state => state.SocketListener.connected)
  const [currentUser] = useCurrentUser()
  const { id: threadId } = useRouteParams()

  const messageListRef = useRef()
  const prevMessagesRef = useRef(null)
  const prevThreadIdRef = useRef(threadId)

  const [cursor, setCursor] = useState(null)
  const [newMessages, setNewMessages] = useState(0)
  const [notify, setNotify] = useState(false)

  const [shouldScroll, setShouldScroll] = useState(false)
  // NOTE: we write directly to the object rather than using setState.
  // This avoids an automatic re-render on scroll, and any inconsistencies
  // owing to the async nature of setState and/or setState batching.
  const [yOffset, setYOffset] = useState(0)
  const atBottom = useMemo(() => yOffset < BOTTOM_THRESHOLD, [yOffset])
  // NOTE: This scrolls to the 'perceived' (by the user) bottom of the thread,
  // which is actually the top! Confused? Inverted lists are fun.
  const scrollToBottom = () => {
    messageListRef.current.scrollToOffset({ offset: 0 })
    setNewMessages(0)
    setNotify(false)
    markAsRead()
  }

  const [, providedCreateMessage] = useMutation(createMessageMutation)
  const createMessage = text => providedCreateMessage({ messageThreadId: threadId, text, createdAt: new Date().toString() })
  const sendIsTyping = () => providedSendIsTyping(threadId, true)
  const updateThreadReadTime = () => dispatch(updateThreadReadTimeAction(threadId))

  const [{ data, fetching }, refetchThread] = useQuery({ query: messageThreadMessagesQuery, variables: { id: threadId, first: MESSAGE_PAGE_SIZE, cursor }})
  const thread = data?.messageThread

  // TODO: URQL handle consolidation of multiple messages from same user
  // function refineMessage ({ id, createdAt, creator, text }, i, messages) {
  //   const creatorFields = pick(['id', 'name', 'avatarUrl'], creator.ref)

  //   // This might seem counter-intuitive, because the list is reversed. These
  //   // values handle compact display of consecutive messages by the same creator
  //   // when received in MessageCard.
  //   const next = i > 0 && i < messages.length ? messages[i - 1] : null
  //   const prev = i > 0 && i < messages.length - 1 ? messages[i + 1] : null
  //   const suppressCreator = prev &&
  //     creator.id === prev.creator.id &&
  //     isWithinBatchLimit(createdAt, prev.createdAt)
  //   const suppressDate = next &&
  //     creator.id === next.creator.id &&
  //     isWithinBatchLimit(next.createdAt, createdAt)

  //   return {
  //     id,
  //     createdAt: TextHelpers.humanDate(createdAt),
  //     creator: creatorFields,
  //     text,
  //     suppressCreator,
  //     suppressDate
  //   }
  // }
  const messages = data?.messageThread?.messages?.items
  const hasMore = data?.messageThread?.messages?.hasMore

  const fetchMore = () => {
    if (messages && hasMore) {
      setCursor(messages[messages?.length - 1].id)
    }
  }

  const setHeader = () => {
    navigation.setOptions({
      headerTitleStyle: { color: rhino10 },
      headerTitle: () => (
        <ThreadHeaderTitle
          thread={thread}
          currentUserId={currentUser?.id}
          navigation={navigation}
        />
      )
    })
  }

  useEffect(() => {
    getSocket().then(socket => socket.on('reconnect', refetchThread))
    scrollToBottom()
    markAsRead()
    setHeader()
    return () => getSocket().then(socket => socket.off('reconnect', refetchThread))
  }, [])

  // Was UNSAFE_componentWillUpdate (nextProps) and componentDidUpdate (prevProps)
  useEffect(() => {
    const prevMessages = prevMessagesRef.current
    const prevThreadId = prevThreadIdRef.current

    // UNSAFE_componentWillUpdate logic (before the update)
    if (!prevMessages) {
      prevMessagesRef.current = messages
      prevThreadIdRef.current = threadId
      return
    }

    const deltaLength = Math.abs(messages.length - prevMessages.length)
    setShouldScroll(false)

    if (deltaLength) {
      const latest = messages[0]
      const oldLatest = prevMessages[0]

      if (latest?.id === oldLatest?.id) {
        if (notify) setNotify(false)
      } else if (deltaLength === 1 && atBottom &&
        latest?.creator?.id !== currentUser?.id
      ) {
        setNewMessages(newMessages + 1)
        setNotify(true)
      } else {
        setShouldScroll(true)
      }
    }

    // componentDidUpdate logic (after the update)
    if (shouldScroll) {
      scrollToBottom()
    }

    if (
      prevThreadId !== threadId ||
      (atBottom && prevMessages.length + 1 === messages.length)
    ) {
      markAsRead()
    }

    setHeader()

    // Update refs for the next render
    prevMessagesRef.current = messages
    prevThreadIdRef.current = threadId
  }, [messages, threadId, shouldScroll, notify, currentUser?.id])

  const handleSubmit = text => createMessage(TextHelpers.markdown(text))

  const markAsRead = debounce(1000, () => updateThreadReadTime())

  const showTopic = topicName => confirmNavigate(() => navigation.navigate('Stream', { topicName }))

  const renderItem = ({ item }) => {
    return (
      <MessageCard message={item} showTopic={showTopic} />
    )
  }

  const handleScroll = ({ nativeEvent: { contentOffset } }) => {
    setYOffset(contentOffset.y)
    if (contentOffset.y < BOTTOM_THRESHOLD) {
      markAsRead()
    }
  }

  const showNotificationOverlay = notify
  const overlayMessage = !isConnected
    ? '' // 'RECONNECTING...'
    : `${newMessages} ${t('NEW MESSAGE')}${newMessages > 1 ? 'S' : ''}`

  return (
    <KeyboardFriendlyView style={styles.container}>
      {fetching && <Loading />}
      <FlatList
        style={styles.messageList}
        data={messages}
        inverted
        keyExtractor={item => item.id}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        ref={messageListRef}
        refreshing={fetching}
        renderItem={renderItem}
      />
      <MessageInput
        blurOnSubmit={false}
        multiline
        onSubmit={handleSubmit}
        sendIsTyping={sendIsTyping}
        placeholder={t('Write something')}
      />
      <PeopleTyping />
      {showNotificationOverlay && (
        <NotificationOverlay
          position='bottom'
          type={isConnected ? 'info' : 'error'}
          permanent={!isConnected}
          message={overlayMessage}
          onPress={() => scrollToBottom()}
        />
      )}
      <SocketSubscriber type='post' id={threadId} />
    </KeyboardFriendlyView>
  )
}
