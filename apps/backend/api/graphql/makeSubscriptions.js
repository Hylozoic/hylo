import { pipe } from 'graphql-yoga'
import { get } from 'lodash/fp'

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

      // NOTE: For ease of testing the subscriptions-debug header can be sent with any value to enable
      // subscriptions publishing to the creator.
      if (creatorId !== currentUserId || context.request.headers.get('subscriptions-debug')) {
        yield payload
      }
    }
  }
}

export default function makeSubscriptions () {
  return {
    comments: {
      subscribe: (parent, { id, postId, commentId }, context) => pipe(
        context.pubSub.subscribe(
          commentId ? `comments:commentId:${commentId}` : `comments:postId:${postId}`
        ),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        return new Comment(payload.comment)
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
        withDontSendToCreator({ context, getter: get('user.id') })
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
        if (payload?.messageThread) {
          const messageThread = new Post(payload.messageThread)
          messageThread.makeModelsType = 'MessageThread'
          return messageThread
        }
        if (payload?.notification) return new Notification(payload.notification)
      }
    }
  }
}
