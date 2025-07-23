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
    }
  }
}
