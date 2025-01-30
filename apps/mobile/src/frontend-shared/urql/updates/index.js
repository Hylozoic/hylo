import createComment from './createComment'
import meCheckAuthQuery from 'frontend-shared/graphql/queries/meCheckAuthQuery'

export default {
  Mutation: {
    addProposalVote: (result, args, cache, info) => { 
      cache.invalidate({ __typename: 'Post', id: args.postId })
    },
    addSkill: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    },
    clearModerationAction: (result, args, cache, info) => {
      if (result[info.fieldName].success) {
        cache.invalidate({ __typename: 'ModerationAction', id: args.moderationActionId })
      }
    },
    createComment,
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
        // Any Post invalidation will result in the full Group/Stream query being re-fetched.
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
      console.log('!!!!! comments - result, args, info:', result, args, info)
    },
    updates: (result, args, cache, info) => {
      const update = result?.updates

      switch (update?.__typename) {
        case 'Message': {
          console.log('!!!! updates TODO: new Message. Increment Messages tab badge', result, args)
          // TODO: URQL - This one may want an updater to keep from killing the cache with each message
          // leaving the cache invalidation off for now.
          // cache.invalidate({ __typename: 'MessageThread', id: update?.messageThread?.id })
          break
        }
        case 'MessageThread': {
          console.log('!!!! updates TODO: new MessageThread. Increment Messages tab badge', result, args)
          cache.invalidate({ __typename: 'MessageThread', id: update?.messageThread?.id })
          break
        }
        case 'Notification': {
          console.log('!!!! updates TODO: new Notification. Increment Notifications badge', result, args)
          cache.invalidate('Query', 'notifications')
          break
        }
        default: {
          console.log('!!! Unhandled update from updates subscription', result)
        }
      }
    }
  }
}
