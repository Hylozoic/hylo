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
        context.pubSub.subscribe(`updates:${context.currentUserId}`),
        withDontSendToCreator({ context })
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
        if (payload?.notification) {
          return new Notification(payload.notification)
        }
      }
    },

    groupUpdates: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`groupUpdates:${context.currentUserId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        if (payload?.group) {
          return new Group(payload.group)
        }
      }
    },

    groupMembershipUpdates: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`groupMembershipUpdates:${context.currentUserId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        if (payload?.groupMembershipUpdate) {
          return {
            group: new Group(payload.groupMembershipUpdate.group),
            member: new User(payload.groupMembershipUpdate.member),
            action: payload.groupMembershipUpdate.action,
            role: payload.groupMembershipUpdate.role,
            makeModelsType: 'GroupMembershipUpdate'
          }
        }
      }
    },

    groupRelationshipUpdates: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`groupRelationshipUpdates:${context.currentUserId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        if (payload?.groupRelationshipUpdate) {
          return {
            parentGroup: new Group(payload.groupRelationshipUpdate.parentGroup),
            childGroup: new Group(payload.groupRelationshipUpdate.childGroup),
            action: payload.groupRelationshipUpdate.action,
            relationship: payload.groupRelationshipUpdate.relationship ? new GroupRelationship(payload.groupRelationshipUpdate.relationship) : null,
            makeModelsType: 'GroupRelationshipUpdate'
          }
        }
      }
    },

    postUpdates: {
      subscribe: (parent, args, context) => pipe(
        context.pubSub.subscribe(`postUpdates:${context.currentUserId}`),
        withDontSendToCreator({ context })
      ),
      resolve: (payload) => {
        if (payload?.post) {
          return new Post(payload.post)
        }
      }
    },

    // UNIFIED SUBSCRIPTION: Combines all user-specific updates into a single stream
    // This reduces the number of SSE connections needed (helpful for Android's 4-connection limit)
    allUpdates: {
      subscribe: async function * (parent, args, context) {
        const userId = context.currentUserId

        // If unauthenticated, return a harmless empty async iterable to avoid 'Async Iterable' errors
        if (!userId) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('allUpdates subscription requested without user; returning empty iterable')
          }
          async function * emptyIterable () { /* noop */ }
          yield * emptyIterable()
          return
        }

        if (process.env.NODE_ENV === 'development') {
          console.log(`🔧 Setting up unified subscription for user ${userId}`)
        }

        // Create individual subscription iterators
        const subscriptions = [
          pipe(context.pubSub.subscribe(`updates:${userId}`), withDontSendToCreator({ context })),
          pipe(context.pubSub.subscribe(`groupUpdates:${userId}`), withDontSendToCreator({ context })),
          pipe(context.pubSub.subscribe(`groupMembershipUpdates:${userId}`), withDontSendToCreator({ context })),
          pipe(context.pubSub.subscribe(`groupRelationshipUpdates:${userId}`), withDontSendToCreator({ context })),
          pipe(context.pubSub.subscribe(`postUpdates:${userId}`), withDontSendToCreator({ context }))
        ]

        // Merge all subscription streams with proper cleanup
        const mergedStream = async function * () {
          const iterators = subscriptions.map(sub => sub[Symbol.asyncIterator]())
          const promises = iterators.map((iterator, index) =>
            iterator.next().then(result => ({ result, index }))
          )

          try {
            while (promises.length > 0) {
              const activePromises = promises.filter(Boolean)
              if (activePromises.length === 0) {
                break
              }

              const { result, index } = await Promise.race(activePromises)

              if (!result.done) {
                if (process.env.NODE_ENV === 'development') {
                  const streamNames = ['updates', 'groupUpdates', 'groupMembershipUpdates', 'groupRelationshipUpdates', 'postUpdates']
                  console.log(`🔧 Unified subscription yielding from ${streamNames[index]} stream:`, Object.keys(result.value))
                }

                yield result.value

                // Replace the resolved promise with the next value from the same iterator
                promises[index] = iterators[index].next().then(nextResult => ({ result: nextResult, index }))
              } else {
                // Remove completed iterator
                promises[index] = null
                // Try to close the iterator if it has a return method
                if (iterators[index] && typeof iterators[index].return === 'function') {
                  try {
                    await iterators[index].return()
                  } catch (err) {
                    // Ignore errors during cleanup
                    if (process.env.NODE_ENV === 'development') {
                      console.warn('Error closing iterator:', err)
                    }
                  }
                }
              }
            }
          } finally {
            // Cleanup: ensure all iterators are properly closed
            for (let i = 0; i < iterators.length; i++) {
              if (iterators[i] && typeof iterators[i].return === 'function') {
                try {
                  await iterators[i].return()
                } catch (err) {
                  // Ignore errors during cleanup
                  if (process.env.NODE_ENV === 'development') {
                    console.warn(`Error closing iterator ${i}:`, err)
                  }
                }
              }
            }
            // Clear promises array
            promises.length = 0
          }
        }

        try {
          yield * mergedStream()
        } finally {
          // Additional cleanup when subscription ends
          if (process.env.NODE_ENV === 'development') {
            console.log(`🔧 Cleaning up unified subscription for user ${userId}`)
          }
        }
      },
      resolve: (payload) => {
        // Route payload to appropriate type based on content
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
        if (payload?.notification) {
          return new Notification(payload.notification)
        }
        if (payload?.group) {
          return new Group(payload.group)
        }
        if (payload?.groupMembershipUpdate) {
          return {
            group: new Group(payload.groupMembershipUpdate.group),
            member: new User(payload.groupMembershipUpdate.member),
            action: payload.groupMembershipUpdate.action,
            role: payload.groupMembershipUpdate.role,
            makeModelsType: 'GroupMembershipUpdate'
          }
        }
        if (payload?.groupRelationshipUpdate) {
          return {
            parentGroup: new Group(payload.groupRelationshipUpdate.parentGroup),
            childGroup: new Group(payload.groupRelationshipUpdate.childGroup),
            action: payload.groupRelationshipUpdate.action,
            relationship: payload.groupRelationshipUpdate.relationship ? new GroupRelationship(payload.groupRelationshipUpdate.relationship) : null,
            makeModelsType: 'GroupRelationshipUpdate'
          }
        }
        if (payload?.post) {
          return new Post(payload.post)
        }

        return null
      }
    }
  }
}
