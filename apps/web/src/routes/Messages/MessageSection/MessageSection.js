import { array, bool, func, object } from 'prop-types'
import React, { Component } from 'react'
import { throttle, debounce } from 'lodash'
import { get } from 'lodash/fp'
import Loading from 'components/Loading'
import Message from '../Message'
import ClickCatcher from 'components/ClickCatcher'

// the maximum amount of time in minutes that can pass between messages to still
// include them under the same avatar and timestamp
const MAX_MINS_TO_BATCH = 5

const lastSeenAtTimes = {}

function createMessageList (messages, lastSeenAt) {
  let currentHeader
  return messages.reduce((acc, m) => {
    let headerDate, messageDate, diff, greaterThanMax
    let isHeader = false
    if (!currentHeader) {
      isHeader = true
      currentHeader = m
    } else {
      headerDate = new Date(currentHeader.createdAt)
      messageDate = new Date(m.createdAt)
      diff = Math.abs(headerDate - messageDate)
      greaterThanMax = Math.floor(diff / 60000) > MAX_MINS_TO_BATCH
      isHeader = greaterThanMax || m.creator.id !== currentHeader.creator.id
      currentHeader = isHeader ? m : currentHeader
    }
    acc.push(<Message message={m} key={`message-${m.id}`} isHeader={isHeader} />)
    return acc
  }, [])
}

export default class MessageSection extends Component {
  constructor (props) {
    super(props)
    this.state = {
      visible: true,
      showNewMessageButton: false,
      onNextVisible: null
    }
  }

  componentDidMount () {
    const { socket, fetchMessages, messageThread, updateThreadReadTime } = this.props
    this.reconnectHandler = () => fetchMessages()
    socket && socket.on('reconnect', this.reconnectHandler)
    document && document.addEventListener('visibilitychange', this.handleVisibilityChange)
    this.setupScrollHandler()
    // Check if we're already at bottom after initial render
    setTimeout(() => {
      this.scrollToBottom()
      const container = document.querySelector('#message-list')
      if (container && this.atBottom(container)) {
        this.markAsRead()
        if (messageThread) updateThreadReadTime(messageThread.id)
      }
    }, 100)
  }

  componentWillUnmount () {
    const { socket } = this.props
    socket && socket.off('reconnect', this.reconnectHandler)
    document && document.removeEventListener('visibilitychange', this.handleVisibilityChange)
  }

  UNSAFE_componentWillUpdate (nextProps) {
    const { currentUser, messages, pending } = nextProps
    if (pending) return

    const oldMessages = this.props.messages
    const deltaLength = Math.abs(messages.length - oldMessages.length)

    this.shouldScroll = false

    if (deltaLength) {
      const latest = messages[messages.length - 1]
      const oldLatest = oldMessages[oldMessages.length - 1]

      // Are additional messages old (at the beginning of the sorted array)?
      if (this.props.hasMore && get('id', latest) === get('id', oldLatest)) return

      const messageList = document.querySelector('#message-list')
      if (messageList) {
        const isScrolledUp = messageList.scrollTop < (messageList.scrollHeight - messageList.clientHeight - 100)
        const isFromOtherUser = get('creator.id', latest) !== get('id', currentUser)

        if (isScrolledUp && isFromOtherUser) {
          this.setState({ showNewMessageButton: true })
          return
        }
      }

      // If there's one new message, it's not from currentUser,
      // and we're not already at the bottom, don't scroll
      if (deltaLength === 1 &&
        get('creator.id', latest) !== get('id', currentUser) &&
        !this.atBottom(document.querySelector('#message-list'))) return

      this.shouldScroll = true
    }
  }

  componentDidUpdate (prevProps) {
    if (this.shouldScroll) setTimeout(() => this.scrollToBottom(), 200)

    const { currentUser, messages, pending, hasMore } = this.props
    // Skip if loading
    if (pending) return

    const deltaLength = Math.abs(messages.length - prevProps.messages.length)

    if (deltaLength) {
      const latest = messages[messages.length - 1]
      const oldLatest = prevProps.messages[prevProps.messages.length - 1]

      // Are additional messages old (at the beginning of the sorted array)?
      if (hasMore && get('id', latest) === get('id', oldLatest)) return

      const centerColumn = document.querySelector('#message-list')
      if (centerColumn) {
        const isScrolledUp = centerColumn.scrollTop < (centerColumn.scrollHeight - centerColumn.clientHeight - 100)
        const isFromOtherUser = get('creator.id', latest) !== get('id', currentUser)
        // If we're at the bottom or the message is from the current user, auto-scroll
        if (!isScrolledUp || !isFromOtherUser) {
          centerColumn.scrollTop = centerColumn.scrollHeight
          this.setState({ showNewMessageButton: false })
        } else if (isFromOtherUser) {
          // If we're scrolled up and it's from another user, show the button
          this.setState({ showNewMessageButton: true })
        }
      }
    }

    // If messages changed (new messages loaded)
    if (prevProps.messages !== this.props.messages) {
      const container = document.querySelector('#message-list')
      if (container && this.atBottom(container)) {
        this.markAsRead()
      }
    }
  }

  atBottom = ({ offsetHeight, scrollHeight, scrollTop }) =>
    scrollHeight - scrollTop - offsetHeight < 1

  handleVisibilityChange = () => {
    const { onNextVisible } = this.state

    if (document && document.hidden) {
      this.setState({ visible: false })
    } else {
      if (onNextVisible) onNextVisible()
      this.setState({ visible: true, onNextVisible: null })
    }
  }

  fetchMore = () => {
    if (this.props.pending) return

    const { hasMore, fetchMessages, messages } = this.props
    const cursor = get('id', messages[0])

    if (cursor && hasMore) {
      fetchMessages()
    }
  }

  detectScrollExtremes = throttle(target => {
    if (this.props.pending) return
    // Marks entire thread as read if we've seen the last message
    if (this.atBottom(target)) {
      this.markAsRead()
      this.setState({ showNewMessageButton: false })
    }
    if (target.scrollTop <= 150) this.fetchMore()
  }, 500, { trailing: true })

  handleScroll = event => {
    this.detectScrollExtremes(event.target)
  }

  scrollToBottom = () => {
    const messageList = document.querySelector('#message-list')
    if (messageList) {
      // Set scrollTop to scrollHeight to scroll to the bottom
      messageList.scrollTop = messageList.scrollHeight
      if (this.state.visible) {
        this.markAsRead()
      } else {
        this.setState({ onNextVisible: this.markAsRead })
      }
      this.setState({ showNewMessageButton: false })
    }
    this.shouldScroll = false
  }

  markAsRead = debounce(() => {
    const { messageThread, updateThreadReadTime } = this.props
    if (messageThread) updateThreadReadTime(messageThread.id)
  }, 2000)

  setupScrollHandler = () => {
    const centerColumn = document.querySelector('#message-list')
    if (centerColumn) {
      centerColumn.addEventListener('scroll', this.handleScroll)
    }
  }

  render () {
    const { messages, pending, messageThread } = this.props
    const { showNewMessageButton } = this.state

    return (
      <div id='message-list' className='w-full overflow-y-auto relative flex-1 min-h-0 pb-4 px-3' onScroll={this.handleScroll} data-testid='message-section'>
        {pending && <Loading />}
        {!pending && (
          <>
            <div className='max-w-[750px] mx-auto pt-[20px] mt-auto flex flex-col justify-end w-full'>
              <ClickCatcher>
                {createMessageList(messages, lastSeenAtTimes[get('id', messageThread)])}
              </ClickCatcher>
            </div>
            {showNewMessageButton && (
              <div className='sticky bottom-20 w-full flex justify-center' style={{ position: '-webkit-sticky' }}>
                <button
                  onClick={this.scrollToBottom}
                  className='bg-primary text-white px-4 py-2 rounded-full shadow-lg hover:bg-primary/90 transition-all z-50'
                >
                  New Messages
                </button>
              </div>
            )}
          </>
        )}
      </div>
    )
  }
}

MessageSection.propTypes = {
  fetchMessages: func.isRequired,
  hasMore: bool,
  messageThread: object,
  messages: array,
  pending: bool,
  socket: object,
  currentUser: object,
  updateThreadReadTime: func
}
