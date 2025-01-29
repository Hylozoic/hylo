import reactOn from './reactOn'
import createComment from './createComment'
import meCheckAuthQuery from 'graphql/queries/meCheckAuthQuery'

export default {
  Mutation: {
    // clearModerationAction: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate({ __typename: 'ModerationAction', id: args.moderationActionId })
    //   }
    // },
    createComment,
    // createModerationAction: (result, args, cache, info) => {
    //   if (result[info.fieldName].id) {
    //     const postId = args?.data?.postId
    //     cache.invalidate({ __typename: 'Post', id: postId })
    //   }
    // },
    // createMessage: (result, args, cache, info) => {
    //   cache.invalidate({ __typename: 'MessageThread', id: args.data.messageThreadId })
    // },
    // deleteComment: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate({ __typename: 'Comment', id: args.id })
    //   }
    // },
    // deletePost: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate({ __typename: 'Post', id: args.id })
    //   }
    // },
    // joinProject: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'members')
    //   }
    // },
    // leaveProject: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'members')
    //   }
    // },
    // login: (result, args, cache, info) => {
    //   if (!result?.error) {
    //     cache.updateQuery({ query: meCheckAuthQuery }, data => result?.login)
    //   }
    // },
    // logout: (result, args, cache, info) => {
    //   if (result?.logout?.success) {
    //     cache.updateQuery({ query: meCheckAuthQuery }, data => ({ me: null }))
    //   }
    // },
    // reactOn,
    // recordClickthrough: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     const postId = args?.postId
    //     cache.invalidate({ __typename: 'Post', id: postId })
    //   }
    // },
    // removePost: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate({ __typename: 'Post', id: args.postId })
    //   }
    // },
    // pinPost: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate({ __typename: 'Post', id: args.postId })
    //   }
    // },
    // respondToEvent: (result, args, cache, info) => {
    //   if (result[info.fieldName].success) {
    //     cache.invalidate(cache.keyOfEntity({ __typename: 'Post', id: args.id }), 'myEventResponse')
    //   }
    // }
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
          cache.invalidate({ __typename: 'MessageThread', id: update?.messageThread?.id })
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
