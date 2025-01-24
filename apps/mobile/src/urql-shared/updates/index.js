import reactOn from './reactOn'
import createComment from './createComment'
import meCheckAuthQuery from 'graphql/queries/meCheckAuthQuery'

export default {
  Mutation: {
    createComment,
    createMessage: (result, args, cache, info) => {
      cache.invalidate({ __typename: 'MessageThread', id: args.data.messageThreadId })
    },
    deleteComment: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Comment', id: args.id })
      }
    },
    deletePost: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Post', id: args.id })
      }
    },
    joinProject: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'members')
      }
    },
    leaveProject: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'members')
      }
    },
    login: (result, args, cache, info) => {
      if (!result?.error) {
        cache.updateQuery({ query: meCheckAuthQuery }, data => result?.login)
      }
    },
    logout: (result, args, cache, info) => {
      if (result?.logout?.success) {
        cache.updateQuery({ query: meCheckAuthQuery }, data => ({ me: null }))
      }
    },
    reactOn,
    removePost: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Post', id: args.postId })
      }
    },
    pinPost: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Post', id: args.postId })
      }
    },
    respondToEvent: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'myEventResponse')
      }
    }
  },
  Subscription: {
    commentCreated: (result, args, cache, info) => {
      // import { showMessagesBadge } from 'store/reducers/ormReducer/util'
      // case RECEIVE_THREAD:
      //   // Me.first().increment('unseenThreadCount')
      //   break
      // case RECEIVE_MESSAGE:
      //   // const { message: { messageThread, createdAt } } = payload.data
      //   // if (MessageThread.idExists(messageThread)) {
      //   //   MessageThread.withId(messageThread).update({ updatedAt: createdAt })
      //   // }
      //   // showMessagesBadge(session)
      //   break
      console.log('!!!!! commentCreated - result, args, info:', result, args, info)
    }
  }
}
