import { get } from 'lodash/fp'
import meQuery from '@hylo/graphql/queries/meQuery'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import makeAppendToPaginatedSetResolver from './makeAppendToPaginatedSetResolver'

export default {
  Mutation: {
    addProposalVote: (result, args, cache, info) => {
      // TODO: URQL - This will result in Me being fully re-queried with every new skilled added, which may be fine...
      // but probably can apply makeAppendToPaginatedSetResolver here as it is a QuerySet
      cache.invalidate({ __typename: 'Post', id: args.postId })
    },

    addSkill: (result, args, cache, info) => {
      // TODO: URQL - This will result in Me being fully re-queried with every new skilled added, which may be fine...
      // but probably can apply makeAppendToPaginatedSetResolver here as it is a QuerySet
      cache.invalidate('Query', 'me')
    },

    clearModerationAction: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'ModerationAction', id: args.moderationActionId })
      }
    },

    createComment: (result, args, cache, info) => {
      const parentId = args?.data?.parentCommentId || args?.data?.postId
      const parentType = args?.data?.parentCommentId ? 'Comment' : 'Post'
      const fieldName = args?.data?.parentCommentId ? 'childComments' : 'comments'
      makeAppendToPaginatedSetResolver({
        parentType,
        parentId,
        fieldName
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

    recordClickthrough: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        const postId = args?.postId
        cache.invalidate({ __typename: 'Post', id: postId })
      }
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
        // That is probably entirely ok, but there are several ways to do better. One way we could
        // potentially solve this is by creating a singular post resolver so URQL knows how to manage
        // this better. Still researching here and around...
        cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.postId }), 'postMemberships')
      }
    },

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
          return
        }

        case 'MessageThread': {
          cache.updateQuery({ query: meQuery }, ({ me }) => {
            if (!me) return null
            return { me: { ...me, unseenThreadCount: me.unseenThreadCount + 1 } }
          })
          return
        }

        case 'Notification': {
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
