import { pipe } from '@graphql-yoga/node'
import { get } from 'lodash/fp'

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

export default function makeSubscriptions({ models, resolvers, expressContext, userId, isAdmin, fetchOne, fetchMany }) {
  return {
    // NOTE: comment:id and comment:parentCommentId subscriptions are here for completeness
    // though they are not as of 20250125 not used in either Web or Mobile
    comment: {
      subscribe: (parent, { userId, id, postId, parentCommentId }, context) => pipe(
        context.pubSub.subscribe(
          id
            ? `comment:${id}`
            : parentCommentId
              ? `comment:parentCommentId:${parentCommentId}`
              : `comment:postId:${postId}`
        ),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        // Rehydrate the JSON serialized and re-parsed Bookshelf instance
        return new Comment(payload.comment)
      }
    },

    peopleTyping: {
      subscribe: (parent, { postId, commentId }, context) => pipe(
        context.pubSub.subscribe(postId ? `peopleTyping:postId:${postId}` : `peopleTyping:commentId:${commentId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        // TODO: Monitor performance-- this is a very quick query (~6ms in local dev),
        // but will happen every 3-5 second while someone is actively typing.
        return User.find(payload.user.id)
      }
    }
  }
}
