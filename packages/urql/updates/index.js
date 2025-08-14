import { get } from 'lodash/fp'
import meQuery from '@hylo/graphql/queries/meQuery'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import makeAppendToPaginatedSetResolver from './makeAppendToPaginatedSetResolver'
import { reactOn, deleteReaction } from './reactions'
import { handleReactionPostCompletion } from './sideEffectPostCompletion'

// Set to true to enable debug logging for group subscriptions
const isDev = process.env.NODE_ENV === 'development'

const subscriptionHandlers = {
  updates: (result, args, cache, info) => {
    const update = result?.updates

    if (update) {
      if (isDev) {
        console.log('📱 Received notification update:', update.activity?.action || 'unknown action')
      }

      // For Messages and MessageThreads, handle differently
      if (update.message) {
        // This is a direct message
        cache.invalidate({ __typename: 'Message', id: update.message.id })

        // Invalidate the message thread
        if (update.message.messageThread) {
          cache.invalidate({ __typename: 'MessageThread', id: update.message.messageThread.id })
        }

        // Invalidate messageThreads query to update the list
        const messageThreadsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'messageThreads')
        messageThreadsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Update Me query to reflect new message count
        cache.updateQuery({ query: meQuery }, ({ me }) => {
          if (!me) return null
          return {
            me: {
              ...me,
              unseenThreadCount: me.unseenThreadCount + 1
            }
          }
        })
      } else if (update.messageThread) {
        // This is a message thread update
        cache.invalidate({ __typename: 'MessageThread', id: update.messageThread.id })

        // Invalidate messageThreads query
        const messageThreadsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'messageThreads')
        messageThreadsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      } else if (update.notification) {
        // This is a notification
        cache.invalidate({ __typename: 'Notification', id: update.notification.id })

        // Invalidate notifications query
        const notificationsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'notifications')
        notificationsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Update Me query to reflect new notification count
        cache.updateQuery({ query: meQuery }, ({ me }) => {
          if (!me) return null
          return {
            me: {
              ...me,
              newNotificationCount: me.newNotificationCount + 1
            }
          }
        })
      }
    }
  },

  groupUpdates: (result, args, cache, info) => {
    const update = result?.groupUpdates

    if (update) {
      if (isDev) {
        console.log(`📱 Received group update: ${update.name} (${update.id})`)
      }

      // Invalidate the specific group
      cache.invalidate({ __typename: 'Group', id: update.id })

      // Find and invalidate any group queries for this specific group
      const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
      groupFields.forEach(field => {
        // Check if this field is for the updated group
        if (field.arguments?.id === update.id || field.arguments?.slug === update.slug) {
          cache.invalidate('Query', field.fieldKey)
        }
      })

      // Invalidate groups list queries
      const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
      groupsFields.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })

      // Update Me query to reflect any group changes
      cache.updateQuery({ query: meQuery }, (data) => {
        if (!data?.me) return null
        // Force refetch of user's groups by invalidating
        return data
      })
    }
  },

  groupMembershipUpdates: (result, args, cache, info) => {
    const update = result?.groupMembershipUpdates

    if (update) {
      if (isDev) {
        console.log(`📱 Received membership update: ${update.member.name} ${update.action} ${update.group.name}`)
      }

      // Invalidate the specific group to trigger membership refetch
      cache.invalidate({ __typename: 'Group', id: update.group.id })

      // Update Me query to reflect membership changes
      cache.updateQuery({ query: meQuery }, (data) => {
        if (!data?.me) return null

        const { me } = data
        const existingMemberships = me.memberships || []
        if (update.action === 'joined' || update.action === 'rejoined') {
          // Check if membership already exists
          const existingMembership = existingMemberships.find(m => m.group.id === update.group.id)
          if (!existingMembership) {
            // Add new membership
            const newMembership = {
              __typename: 'GroupMembership',
              id: `temp-${update.group.id}`, // Temporary ID
              group: update.group,
              role: update.role || 0,
              hasModeratorRole: update.role === 1,
              settings: {}
            }
            return {
              me: {
                ...me,
                memberships: [...existingMemberships, newMembership]
              }
            }
          }
        } else if (update.action === 'left') {
          // Remove membership
          const filteredMemberships = existingMemberships.filter(m => m.group.id !== update.group.id)
          return {
            me: {
              ...me,
              memberships: filteredMemberships
            }
          }
        }

        return data
      })

      // Invalidate related group queries
      const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
      groupFields.forEach(field => {
        if (field.arguments?.id === update.group.id || field.arguments?.slug === update.group.slug) {
          cache.invalidate('Query', field.fieldKey)
        }
      })

      // Invalidate groups list queries
      const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
      groupsFields.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })
    }
  },

  groupRelationshipUpdates: (result, args, cache, info) => {
    const update = result?.groupRelationshipUpdates

    if (update) {
      if (isDev) {
        console.log(`📱 Received relationship update: ${update.action} between ${update.parentGroup.name} and ${update.childGroup.name}`)
      }

      // Invalidate both groups involved in the relationship
      cache.invalidate({ __typename: 'Group', id: update.parentGroup.id })
      cache.invalidate({ __typename: 'Group', id: update.childGroup.id })

      // Invalidate group queries for both groups
      const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
      groupFields.forEach(field => {
        if (field.arguments?.id === update.parentGroup.id ||
            field.arguments?.slug === update.parentGroup.slug ||
            field.arguments?.id === update.childGroup.id ||
            field.arguments?.slug === update.childGroup.slug) {
          cache.invalidate('Query', field.fieldKey)
        }
      })

      // Invalidate groups list queries
      const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
      groupsFields.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })
    }
  },

  postUpdates: (result, args, cache, info) => {
    const update = result?.postUpdates

    if (update) {
      if (isDev) {
        console.log(`📱 Received post update: ${update.name || 'Untitled'} (${update.id})`)
      }

      // Invalidate the specific post to trigger cache updates
      cache.invalidate({ __typename: 'Post', id: update.id })

      const allQueryFields = cache.inspectFields('Query')
      const postDetailsQueries = allQueryFields.filter(f =>
        f.fieldName === 'post' && f.arguments?.id === update.id
      )
      postDetailsQueries.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })

      const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
      groupFields.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })

      // NOTE: Comment updates (adding/editing comments, reactions on comments) are handled
      // by the separate 'comments' subscription, not postUpdates. The postUpdates subscription
      // only handles post-level changes like reactions on posts, votes, completion, etc.
      // See: apps/backend/api/graphql/makeSubscriptions.js -> comments subscription

      const postsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'posts')
      postsFields.forEach(field => {
        cache.invalidate('Query', field.fieldKey)
      })
    }
  },

  // UNIFIED SUBSCRIPTION HANDLER: Routes updates from allUpdates to appropriate handlers
  allUpdates: (result, args, cache, info) => {
    const update = result?.allUpdates
    if (!update) return

    // Route to existing handlers based on typename and content
    const typename = update.__typename

    if (isDev) {
      console.log('📱 Unified subscription received update:', typename, update.id || update.name || 'unknown')
    }

    switch (typename) {
      case 'Notification': {
        // Handle as updates subscription
        subscriptionHandlers.updates({ updates: update }, args, cache, info)
        break
      }

      case 'Group': {
        // Handle as groupUpdates subscription
        subscriptionHandlers.groupUpdates({ groupUpdates: update }, args, cache, info)
        break
      }

      case 'GroupMembershipUpdate': {
        // Handle as groupMembershipUpdates subscription
        subscriptionHandlers.groupMembershipUpdates({ groupMembershipUpdates: update }, args, cache, info)
        break
      }

      case 'GroupRelationshipUpdate': {
        // Handle as groupRelationshipUpdates subscription
        subscriptionHandlers.groupRelationshipUpdates({ groupRelationshipUpdates: update }, args, cache, info)
        break
      }

      case 'Post': {
        // Handle as postUpdates subscription
        subscriptionHandlers.postUpdates({ postUpdates: update }, args, cache, info)
        break
      }

      case 'Comment': {
        // Handle messages (Comments with makeModelsType = 'Message')
        if (update.makeModelsType === 'Message') {
          subscriptionHandlers.updates({ updates: { message: update } }, args, cache, info)
        }
        break
      }

      default: {
        if (isDev) {
          console.log('⚠️ Unhandled unified update type:', typename, update)
        }
      }
    }
  }
}

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
        const me = result?.login?.me
        // Hydrate both mini-me (auth check) and big me immediately
        cache.updateQuery({ query: meCheckAuthQuery }, () => ({ me }))
        cache.updateQuery({ query: meQuery }, () => ({ me }))
        // Ensure any stale field-level results are not returned
        cache.invalidate('Query', 'me')
      }
    },

    logout: (result, args, cache, info) => {
      if (result?.logout?.success) {
        // Clear both queries so readers see null immediately
        cache.updateQuery({ query: meCheckAuthQuery }, () => ({ me: null }))
        cache.updateQuery({ query: meQuery }, () => ({ me: null }))
        // Invalidate normalized Me entity and root field so nothing stale lingers
        cache.invalidate('Query', 'me')
        cache.invalidate({ __typename: 'Me', id: 'me' })
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

    // See note on these updaters in the file these are imported from
    reactOn: (result, args, cache, info) => {
      // Run the original reactOn handler
      reactOn(result, args, cache, info)
      // Run the completion handler
      handleReactionPostCompletion(result, args, cache, info)
    },
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
      const updatedMembership = result?.[info.fieldName]

      if (!updatedMembership?.id) return

      cache.updateQuery({ query: meQuery }, (data) => {
        if (!data?.me) return null
        const { me } = data

        return {
          me: {
            ...me,
            memberships: me.memberships.map(m =>
              m.id === updatedMembership.id ? { ...m, ...updatedMembership } : m
            )
          }
        }
      })
    },

    verifyEmail: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    },

    acceptGroupRelationshipInvite: (result, args, cache, info) => {
      if (result.acceptGroupRelationshipInvite.success) {
        // Refresh group queries for both parent and child groups
        const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
        groupFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Refresh groups list queries to show updated relationships
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    },

    addModerator: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    addPostToCollection: (result, args, cache, info) => {
      const { collectionId } = args
      cache.invalidate({ __typename: 'Collection', id: collectionId })
    },

    addRoleToMember: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    cancelGroupRelationshipInvite: (result, args, cache, info) => {
      if (result.cancelGroupRelationshipInvite.success) {
        // Refresh group queries
        const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
        groupFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Refresh groups list queries
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    },

    createInvitation: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    createPost: (result, args, cache, info) => {
      cache.invalidate('Query', 'posts')
    },

    deleteGroupRelationship: (result, args, cache, info) => {
      if (result.deleteGroupRelationship.success) {
        // Refresh group queries for both parent and child groups
        const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
        groupFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Refresh groups list queries to show updated relationships
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    },

    joinGroup: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
      cache.invalidate('Query', 'me')
    },

    leaveGroup: (result, args, cache, info) => {
      const { id } = args
      cache.invalidate({ __typename: 'Group', id })
      cache.invalidate('Query', 'me')
    },

    rejectGroupRelationshipInvite: (result, args, cache, info) => {
      if (result.rejectGroupRelationshipInvite.success) {
        // Refresh group queries
        const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
        groupFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Refresh groups list queries
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    },

    removeMember: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    removeModerator: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    removeRoleFromMember: (result, args, cache, info) => {
      const { groupId } = args
      cache.invalidate({ __typename: 'Group', id: groupId })
    },

    requestToAddGroupToParent: (result, args, cache, info) => {
      if (result.requestToAddGroupToParent.success) {
        // Refresh group queries
        const groupFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'group')
        groupFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })

        // Refresh groups list queries
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    },

    updateGroupSettings: (result, args, cache, info) => {
      const { id } = args
      cache.invalidate({ __typename: 'Group', id })
    },

    updatePost: (result, args, cache, info) => {
      cache.invalidate('Query', 'posts')
    },

    useInvitation: (result, args, cache, info) => {
      cache.invalidate('Query', 'me')
    }
  },
  Subscription: {
    comments: (result, args, cache, info) => {
      const comment = result?.comments
      const postId = comment?.post?.id

      if (!comment) {
        return
      }

      if (!postId) {
        return
      }

      try {
        makeAppendToPaginatedSetResolver({
          parentType: 'Post',
          parentId: postId,
          fieldName: 'comments'
        })(result, args, cache, info)
      } catch (error) {
        console.error('❌ Error processing comment subscription:', error)
      }
    },

    // Use the subscription handlers defined above
    ...subscriptionHandlers
  }
}
