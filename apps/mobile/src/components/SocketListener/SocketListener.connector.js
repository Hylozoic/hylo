import { bindActionCreators } from 'redux'
import { connect } from 'react-redux'
import { get } from 'lodash/fp'
import {
  receiveNotification,
  receivePost,
  receiveThread,
  handleEvent
} from './SocketListener.store'
// import getCurrentGroup from 'store/selectors/getCurrentGroup'

// TODO: URQL - convert sockets

export function mapStateToProps (state, props) {
  return {
    // group: getCurrentGroup(state, props)
    group: null
  }
}

export function mapDispatchToProps (dispatch, props) {
  return {
    receiveThread: data => dispatch(receiveThread(convertToThread(data))),
    receiveNotification: data => dispatch(receiveNotification(data)),
    setupCoreEventHandlers: setupCoreEventHandlers(dispatch),

    ...bindActionCreators({
      receivePost
    }, dispatch)
  }
}

export function mergeProps (stateProps, dispatchProps) {
  const groupId = get('id', stateProps.group)
  return {
    ...stateProps,
    ...dispatchProps,
    receivePost: data => {
      return dispatchProps.receivePost(data, groupId)
    }
  }
}

export default connect(mapStateToProps, mapDispatchToProps, mergeProps)

function convertToThread (data) {
  if (data.createdAt) {
    // data is already in GraphQL/redux-orm style
    return {
      ...data,
      createdAt: new Date(data.createdAt).toString(),
      updatedAt: new Date(data.updatedAt).toString(),
      messages: data.messages.map(({ id, createdAt, text, creator }) => ({
        id,
        text,
        creator,
        createdAt: new Date(createdAt).toString(),
        messageThread: data.id
      })),
      unreadCount: 1
    }
  }

  const { id, created_at, updated_at, people, comments } = data
  return {
    id,
    createdAt: new Date(created_at).toString(),
    updatedAt: new Date(updated_at).toString(),
    participants: people.map(({ id, name, avatar_url }) => ({ id, name, avatarUrl: avatar_url })),
    messages: comments.map(c => convertToMessage({ message: c, postId: id })),
    unreadCount: 1
  }
}

function convertToMessage (data) {
  if (data.createdAt) {
    // data is already in GraphQL/redux-orm style
    return {
      ...data,
      createdAt: new Date(data.createdAt).toString()
    }
  }

  const { message: { id, created_at, text, user_id }, postId } = data
  return {
    id,
    createdAt: new Date(created_at).toString(),
    text,
    creator: user_id,
    messageThread: postId
  }
}

const setupCoreEventHandlers = dispatch => socket => {
  const handle = name => arg => dispatch(handleEvent(name, arg))
  const events = [
    'connect',
    'connect_timeout',
    'error',
    'disconnect',
    'reconnect',
    'reconnect_attempt',
    'reconnecting',
    'reconnect_error',
    'reconnect_failed',
    'pong'
  ]
  events.forEach(name => socket.on(name, handle(name)))
}
