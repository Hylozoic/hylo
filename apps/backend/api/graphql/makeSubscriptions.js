import { pipe } from '@graphql-yoga/node'
import { get } from 'lodash/fp'
import { getTypeForInstance } from './index'

// From WebSockets
// const validMessageTypes = [
//   x'commentAdded',
//   x'messageAdded',
//   x'userTyping',
//   'newThread',
//   'newNotification',
//   'newPost'
// ]

/**
 * Filters out subscription events where the current user is the creator.
 * @param {Object} options - Options for filtering.
 * @param {Object} options.context - The GraphQL context containing `currentUserId`.
 * @param {Function} [options.getter] - Optional custom getter to extract the creator ID.
 * @returns {Function} - A function that filters subscription payloads.
 */
const withDontSendToCreator = ({ context, getter } = {}) => {
  return async function * (asyncIterator) {
    for await (const payload of asyncIterator) {
      const currentUserId = context.currentUserId
      const inferredKey = Object.keys(payload)[0]
      const creatorId = getter
        ? getter(payload)
        : get(`${inferredKey}.user.id`, payload)

      console.log(
        'Filtering event:',
        'Payload:', payload,
        'Skipping (except in dev):', creatorId === currentUserId,
        'Creator ID:', creatorId,
        'Current User ID:', currentUserId
      )

      // NOTE: For ease of testing this will for now still send for currentUser while in development
      if (creatorId !== currentUserId || process.env.NODE_ENV === 'development') {
        yield payload
      }
    }
  }
}

export default function makeSubscriptions () {
  return {
    comment: {
      subscribe: (parent, { id, postId, parentCommentId }, context) => pipe(
        context.pubSub.subscribe(
          parentCommentId
            ? `comment:parentCommentId:${parentCommentId}`
            : `comment:postId:${postId}`
        ),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        return new Comment(payload.comment)
      }
    },

    // Deprecated in preference to updates subscription
    message: {
      subscribe: (parent, { id, messageThreadId }, context) => pipe(
        context.pubSub.subscribe(`message:messageThreadId:${messageThreadId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        console.log('!! message:', payload)
        return new Comment(payload.message)
      }
    },

    // Deprecated in preference to updates subscription
    newMessageThread: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`newMessageThread:${context.currentUserId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        console.log('!! newMessageThread:', payload)
        return new Post(payload.newMessageThread)
      }
    },

    // Deprecated in preference to updates subscription
    notification: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`notification:${context.currentUserId}`)
      ),
      resolve: (payload) => {
        return new Notification(payload.notification)
      }
    },

    peopleTyping: {
      subscribe: (parent, { messageThreadId, postId, commentId }, context) => pipe(
        context.pubSub.subscribe(
          messageThreadId
            ? `peopleTyping:messageThreadId:${messageThreadId}`
            : postId 
              ? `peopleTyping:postId:${postId}`
              : `peopleTyping:commentId:${commentId}`
        ),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        return User.find(payload.user.id)
      }
    },

    updates: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`updates:${context.currentUserId}`)
        // withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        if (payload?.message) {
          const message = new Comment(payload.message)
          message.makeModelsType = 'Message'
          return message
        }
        if (payload?.messageThread) return new MessageThread(payload.messageThread)
        if (payload?.notification) return new Notification(payload.notification)
      }
    }
  }
}
