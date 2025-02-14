import React, { useCallback, useMemo, useRef, useState } from 'react'
import { StyleSheet } from 'react-native'
import { FlashList } from '@shopify/flash-list'
import { useTranslation } from 'react-i18next'
import { useFocusEffect, useNavigation } from '@react-navigation/native'
import { gql, useMutation, useQuery } from 'urql'
import { debounce } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import messageThreadMessagesQuery from '@hylo/graphql/queries/messageThreadMessagesQuery'
import createMessageMutation from '@hylo/graphql/mutations/createMessageMutation'
import useCurrentUser from '@hylo/hooks/useCurrentUser'
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

const markThreadReadMutation = gql`
  mutation MarkThreadReadMutation ($messageThreadId: ID) {
    markThreadRead(messageThreadId: $messageThreadId) {
      id
      unreadCount
    }
  }
`

export default function Thread() {
  const { t } = useTranslation()
  const navigation = useNavigation()
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
  const [, providedMarkAsRead] = useMutation(markThreadReadMutation)
  const markAsRead = debounce(1000, () => { providedMarkAsRead({ messageThreadId: threadId }) })

  // Not currently used, but once we have subscription applied we can turn it back on
  const [newMessages, setNewMessages] = useState()
  const [yOffset, setYOffset] = useState(0)
  const atBottom = useMemo(() => yOffset < BOTTOM_THRESHOLD, [yOffset])

  const isWithinBatchLimit = (timestamp1, timestamp2) => {
    return Math.abs(new Date(timestamp1) - new Date(timestamp2)) <= BATCH_LIMIT_MS
  }

  const refineMessages = messages => {
    return messages.map((msg, i, arr) => {
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
  }

  const fetchMore = () => {
    if (!fetching && messages && messages?.length) {
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

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerTitleStyle: { color: rhino10 },
        headerTitle: () => (
          <ThreadHeaderTitle thread={data?.messageThread} currentUserId={currentUser?.id} />
        )
      })
      markAsRead()
    }, [data?.messageThread])
  )

  // New message indicator disabled for now, needs more thought
  // useEffect(() => {
  //   if (messages.length && atBottom) {
  //     setNewMessages(1)
  //   }
  // }, [messages, atBottom])

  return (
    <KeyboardFriendlyView style={styles.container}>
      {fetching && (
        <Loading />
      )}
      <FlashList
        style={styles.messageList}
        data={refineMessages(messages)}
        estimatedItemSize={60}
        inverted
        keyExtractor={(item) => item.id}
        refreshing={fetching}
        onEndReached={fetchMore}
        onEndReachedThreshold={0.3}
        onScroll={handleScroll}
        ref={messageListRef}
        renderItem={({ item }) => (
          <MessageCard message={item} />
        )}
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
