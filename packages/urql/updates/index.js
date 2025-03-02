import { get } from 'lodash/fp'
import meQuery from '@hylo/graphql/queries/meQuery'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import makeAppendToPaginatedSetResolver from './makeAppendToPaginatedSetResolver'
import { reactOn, deleteReaction } from './reactions'

export default {
  Mutation: {
    addProposalVote: (result, args, cache, info) => {
      // Note: Any Post invalidation will result in the full Group/Stream query being re-fetched.
      cache.invalidate({ __typename: 'Post', id: args.postId })
    },

    addSkill: (result, args, cache, info) => {
      // TODO: URQL - This will result in Me being fully re-queried with every new skilled added
      // probably can apply makeAppendToPaginatedSetResolver here as it is a QuerySet
      cache.invalidate('Query', 'me')
    },

    clearModerationAction: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'ModerationAction', id: args.moderationActionId })
      }
    },

    createComment: (result, args, cache, info) => {
      makeAppendToPaginatedSetResolver({
        parentType: args?.data?.parentCommentId ? 'Comment' : 'Post',
        parentId: args?.data?.parentCommentId || args?.data?.postId,
        fieldName: args?.data?.parentCommentId ? 'childComments' : 'comments'
      })(result, args, cache, info)
    },

    createMessage: makeAppendToPaginatedSetResolver({
      parentType: 'MessageThread',
      fieldName: 'messages',
      parentIdGetter: get('data.messageThreadId')
    }),

    createModerationAction: (result, args, cache, info) => {
      if (result[info.fieldName].id) {
        const postId = args?.data?.postId
        cache.invalidate({ __typename: 'Post', id: postId })
      }
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

    markAllActivitiesRead: (result, args, cache, info) => {
      if (result?.markAllActivitiesRead?.success) {
        // Take note of how to invalidate all results of a root Query (without having to know the args)
        const notificationsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'notifications')
        notificationsFields.forEach(field => cache.invalidate('Query', field.fieldKey))
        cache.updateQuery({ query: meQuery }, ({ me }) => {
          if (!me) return null
          return { me: { ...me, newNotificationCount: 0 } }
        })
      }
    },

    recordClickthrough: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        const postId = args?.postId
        cache.invalidate({ __typename: 'Post', id: postId })
      }
    },

    register: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    },

    removePost: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'Post', id: args.postId })
      }
    },

    removeProposalVote: (result, args, cache, info) => { 
      cache.invalidate({ __typename: 'Post', id: args.postId })
    },

    pinPost: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        // Note: Any Post invalidation will result in the full Group/Stream query being re-fetched.
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.postId }), 'postMemberships')
      }
    },

    // See note on these updaters in the file these are imported from
    reactOn,
    deleteReaction,

    respondToEvent: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'myEventResponse')
      }
    },

    swapProposalVote: (result, args, cache, info) => {
      cache.invalidate({ __typename: 'Post', id: args.postId })
    },

    removeSkill: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    },

    updateMembership: (result, args, cache, info) => {
      if (result[info.fieldName].id) {
        cache.invalidate('Query', 'me')
      }
    },

    verifyEmail: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    }
  },
  Subscription: {
    comments: (result, args, cache, info) => {
      makeAppendToPaginatedSetResolver({
        parentType: 'Post',
        parentId: result?.comments?.post?.id,
        fieldName: 'comments'
      })(result, args, cache, info)
    },

    updates: (result, args, cache, info) => {
      const update = result?.updates

      switch (update?.__typename) {
        case 'Message': {
          makeAppendToPaginatedSetResolver({
            parentType: 'MessageThread',
            parentId: update?.messageThread?.id,
            fieldName: 'messages'
          })(result, args, cache, info)
          cache.invalidate({ __typename: 'MessageThread', id: update?.messageThread?.id })
          cache.updateQuery({ query: meQuery }, ({ me }) => {
            if (!me) return null
            return { me: { ...me, unseenThreadCount: me.unseenThreadCount + 1 } }
          })
          return
        }

        case 'MessageThread': {
          makeAppendToPaginatedSetResolver({
            parentType: 'Me',
            fieldName: 'messageThreads'
          })(result, args, cache, info)
          cache.updateQuery({ query: meQuery }, ({ me }) => {
            if (!me) return null
            return { me: { ...me, unseenThreadCount: me.unseenThreadCount + 1 } }
          })
          return
        }

        case 'Notification': {
          makeAppendToPaginatedSetResolver({
            parentType: 'Query',
            fieldName: 'notifications'
          })(result, args, cache, info)
          cache.updateQuery({ query: meQuery }, ({ me }) => {
            if (!me) return null
            return { me: { ...me, newNotificationCount: me.newNotificationCount + 1 } }
          })
          return
        }

        default: {
          console.log('ℹ️ Unhandled update from updates subscription', result, args)
        }
      }
    }
  }
}
