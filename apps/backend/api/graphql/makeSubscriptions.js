import { pipe } from '@graphql-yoga/node'
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
        'Skipping:', creatorId === currentUserId,
        'Creator ID:', creatorId,
        'Current User ID:', currentUserId
      )

      if (creatorId !== currentUserId) {
        yield payload
      }
    }
  }
}

export default function makeSubscriptions({ models, resolvers, expressContext, userId, isAdmin, fetchOne, fetchMany }) {
  return {
    commentCreated: {
      subscribe: (parent, { postId }, context) => pipe(
        context.pubSub.subscribe(`commentCreated-postId-${postId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        // Rehydrate the JSON serialized and re-parsed Bookshelf instance
        return new Comment(payload.commentCreated)
      }
    },

    messageCreated: {
      subscribe: (_, { threadId }, context) => {
        console.log('!!!! currentUserId', context.currentUserId)
        const channel = `MESSAGE_ADDED_${threadId}`
        return context.pubSub.subscribe(channel)
      }
    }
  }
}
