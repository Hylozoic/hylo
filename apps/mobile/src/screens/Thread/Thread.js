import React from 'react'
import { FlatList } from 'react-native'
import { throttle, debounce } from 'lodash'
import { get } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { getSocket } from 'util/websockets'
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
import { withTranslation } from 'react-i18next'

const BOTTOM_THRESHOLD = 10

class Thread extends React.Component {
  constructor (props) {
    super(props)
    this.state = {
      newMessages: 0,
      notify: false
    }
    this.messageListRef = React.createRef()

    // NOTE: we write directly to the object rather than using setState.
    // This avoids an automatic re-render on scroll, and any inconsistencies
    // owing to the async nature of setState and/or setState batching.
    this.yOffset = 0
  }

  setHeader () {
    const { navigation, thread, currentUserId } = this.props

    navigation.setOptions({
      headerTitleStyle: { color: rhino10 },
      headerTitle: () => (
        <ThreadHeaderTitle
          thread={thread}
          currentUserId={currentUserId}
          navigation={navigation}
        />
      )
    })
  }

  async componentDidMount () {
    const { fetchMessages, reconnectFetchMessages } = this.props
    const socket = await getSocket()
    socket.on('reconnect', reconnectFetchMessages)
    this.scrollToBottom()
    await fetchMessages()
    this.markAsRead()
    this.setHeader()
  }

  UNSAFE_componentWillUpdate (nextProps) {
    const { currentUserId, messages } = nextProps

    const oldMessages = this.props.messages
    const deltaLength = Math.abs(messages.length - oldMessages.length)

    this.shouldScroll = false

    if (deltaLength) {
      const latest = messages[0]
      const oldLatest = oldMessages[0]

      // Are additional messages old (at the beginning of the sorted array)?
      if (get('id', latest) === get('id', oldLatest)) {
        // Stops NotificationOverlay showing on infinite scroll
        if (this.state.notify) this.setState({ notify: false })
        return
      }

      // If there's one new message, it's not from currentUser,
      // and we're not already at the bottom, don't scroll
      if (
        deltaLength === 1 && !this.atBottom() &&
        latest?.creator?.id !== currentUserId
      ) {
        this.setState({
          newMessages: this.state.newMessages + 1,
          notify: true
        })
        return
      }

      this.shouldScroll = true
    }
  }

  componentDidUpdate (prevProps) {
    const { id, messages: { length } } = this.props

    if (this.shouldScroll) this.scrollToBottom()

    if (prevProps.id !== id) {
      this.markAsRead()
    } else if (this.atBottom() && prevProps.messages.length + 1 === length) {
      // if you're at the bottom and a new message comes in, consider it read
      // immediately so we don't try to send you a push notification about it.
      this.markAsRead()
    }

    this.setHeader()
  }

  async componentWillUnmount () {
    const { reconnectFetchMessages } = this.props
    const socket = await getSocket()
    socket.off('reconnect', reconnectFetchMessages)
  }

  atBottom = () => this.yOffset < BOTTOM_THRESHOLD

  handleSubmit = text => this.props.createMessage(TextHelpers.markdown(text))

  fetchMore = throttle(() => {
    const { fetchMessages, hasMore, messages, pending } = this.props
    if (pending || !hasMore) return
    fetchMessages(messages[messages.length - 1].id)
  }, 2000)

  markAsRead = debounce(() => this.props.updateThreadReadTime(), 1000)

  renderItem = ({ item }) => {
    return (
      <MessageCard message={item} showTopic={this.props.showTopic} />
    )
  }

  handleScroll = ({ nativeEvent: { contentOffset } }) => {
    this.yOffset = contentOffset.y
    if (contentOffset.y < BOTTOM_THRESHOLD) this.markAsRead()
  }

  // NOTE: This scrolls to the 'perceived' (by the user) bottom of the thread,
  // which is actually the top! Confused? Inverted lists are fun.
  scrollToBottom = () => {
    this.messageListRef.current.scrollToOffset({ offset: 0 })
    this.setState({
      newMessages: 0,
      notify: false
    })
    this.markAsRead()
  }

  render () {
    const {
      id,
      messages,
      pending,
      sendIsTyping,
      isConnected,
      t
    } = this.props
    const { newMessages, notify } = this.state
    const showNotificationOverlay = notify // || !isConnected
    const overlayMessage = !isConnected
      ? '' // 'RECONNECTING...'
      : `${newMessages} ${t('NEW MESSAGE')}${newMessages > 1 ? 'S' : ''}`

    return (
      <KeyboardFriendlyView style={styles.container}>
        {pending && <Loading />}
        <FlatList
          style={styles.messageList}
          data={messages}
          inverted
          keyExtractor={item => item.id}
          onEndReached={() => this.fetchMore()}
          onEndReachedThreshold={0.3}
          onScroll={this.handleScroll}
          ref={this.messageListRef}
          refreshing={!!pending}
          renderItem={this.renderItem}
        />
        <MessageInput
          blurOnSubmit={false}
          multiline
          onSubmit={this.handleSubmit}
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
            onPress={() => this.scrollToBottom()}
          />
        )}
        <SocketSubscriber type='post' id={id} />
      </KeyboardFriendlyView>
    )
  }
}

export default withTranslation()(Thread)
