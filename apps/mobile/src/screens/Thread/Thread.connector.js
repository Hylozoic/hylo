import { connect } from 'react-redux'
import {
  createMessage,
  fetchMessages,
  FETCH_MESSAGES,
  getAndPresentMessages,
  getHasMoreMessages,
  getThread,
  updateThreadReadTime
} from './Thread.store'
import getCurrentUserId from 'store/selectors/getCurrentUserId'
import { sendIsTyping } from 'util/websockets'
import confirmNavigate from 'util/confirmNavigate'

export function mapStateToProps (state, props) {
  const currentUserId = getCurrentUserId(state)
  const thread = getThread(state, props)
  const messages = getAndPresentMessages(state, props)

  return {
    id: thread?.id,
    thread,
    currentUserId,
    hasMore: getHasMoreMessages(state, { id: thread?.id }),
    messages,
    pending: state.pending[FETCH_MESSAGES],
    isConnected: state.SocketListener.connected
  }
}

export function mapDispatchToProps (dispatch, { navigation, route }) {
  const threadId = route.params.id

  return {
    createMessage: text => dispatch(createMessage(threadId, text)),
    fetchMessages: cursor => dispatch(fetchMessages(threadId, { cursor })),
    reconnectFetchMessages: () => dispatch(fetchMessages(threadId, { reset: true })),
    sendIsTyping: () => sendIsTyping(threadId, true),
    updateThreadReadTime: () => dispatch(updateThreadReadTime(threadId)),
    showMember: id => confirmNavigate(() => navigation.navigate('Member', { id })),
    showTopic: topicName => {
      confirmNavigate(() => navigation.navigate('Stream', { topicName }))
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps)
