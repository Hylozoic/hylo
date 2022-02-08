import { connect } from 'react-redux'
import { TextHelpers } from 'hylo-shared'
import {
  createMessage,
  fetchMessages,
  FETCH_MESSAGES,
  getAndPresentMessages,
  getHasMoreMessages,
  getThread,
  presentThread,
  updateThreadReadTime
} from './Thread.store'
import getCurrentUserId from 'store/selectors/getCurrentUserId'
import getCurrentGroupId from 'store/selectors/getCurrentGroupId'
import { sendIsTyping } from 'util/websockets'
import confirmNavigate from 'util/confirmNavigate'

export function mapStateToProps (state, props) {
  const currentUserId = getCurrentUserId(state)
  const groupId = getCurrentGroupId(state)
  const { id, title, participants } = presentThread(getThread(state, props), currentUserId) || {}
  const messages = getAndPresentMessages(state, props)
  return {
    id,
    currentUserId,
    groupId,
    hasMore: getHasMoreMessages(state, { id }),
    messages,
    participants,
    pending: state.pending[FETCH_MESSAGES],
    title,
    isConnected: state.SocketListener.connected
  }
}

export function mapDispatchToProps (dispatch, { navigation, route }) {
  const threadId = route.params.id
  return {
    createMessage: text => dispatch(createMessage(threadId, TextHelpers.sanitize(text))),
    fetchMessages: cursor => dispatch(fetchMessages(threadId, { cursor })),
    reconnectFetchMessages: () => dispatch(fetchMessages(threadId, { reset: true })),
    sendIsTyping: () => sendIsTyping(threadId, true),
    updateThreadReadTime: () => dispatch(updateThreadReadTime(threadId)),
    showMember: id => confirmNavigate(() => navigation.navigate('Member', { id })),
    showTopic: groupId => topicName => {
      confirmNavigate(() => navigation.navigate('Topic Feed', { groupId, topicName }))
    }
  }
}

export function mergeProps (stateProps, dispatchProps, ownProps) {
  const { groupId } = stateProps
  return {
    ...ownProps,
    ...dispatchProps,
    ...stateProps,
    showTopic: dispatchProps.showTopic(groupId)
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)
