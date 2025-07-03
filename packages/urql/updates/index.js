import { get } from 'lodash/fp'
import meQuery from '@hylo/graphql/queries/meQuery'
import meCheckAuthQuery from '@hylo/graphql/queries/meCheckAuthQuery'
import makeAppendToPaginatedSetResolver from './makeAppendToPaginatedSetResolver'
import { reactOn, deleteReaction } from './reactions'
import { handleReactionPostCompletion } from './sideEffectPostCompletion'

// Set to true to enable debug logging for group subscriptions
const isDev = false

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
          cache.updateQuery({ query: meQuery }, (data) => {
            if (!data?.me) return null
            const { me } = data
            return { me: { ...me, unseenThreadCount: me.unseenThreadCount + 1 } }
          })
          return
        }

        case 'MessageThread': {
          makeAppendToPaginatedSetResolver({
            parentType: 'Me',
            fieldName: 'messageThreads'
          })(result, args, cache, info)
          cache.updateQuery({ query: meQuery }, (data) => {
            if (!data?.me) return null
            const { me } = data
            return { me: { ...me, unseenThreadCount: me.unseenThreadCount + 1 } }
          })
          return
        }

        case 'Notification': {
          makeAppendToPaginatedSetResolver({
            parentType: 'Query',
            fieldName: 'notifications'
          })(result, args, cache, info)
          cache.updateQuery({ query: meQuery }, (data) => {
            if (!data?.me) return null
            const { me } = data
            return { me: { ...me, newNotificationCount: me.newNotificationCount + 1 } }
          })
          return
        }

        default: {
          console.log('ℹ️ Unhandled update from updates subscription', result, args)
        }
      }
    },

    groupUpdates: (result, args, cache, info) => {
      const update = result?.groupUpdates

      if (update) {
        if (isDev) {
          console.log(`📱 Received group update: ${update.name} (${update.id})`)
        }

        // Invalidate the specific group to trigger a refetch with updated data
        cache.invalidate({ __typename: 'Group', id: update.id })

        // Also invalidate any group queries that might include this group
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
          const groupId = field.arguments?.id
          const groupSlug = field.arguments?.slug

          if (groupId === update.parentGroup.id || groupId === update.childGroup.id ||
              groupSlug === update.parentGroup.slug || groupSlug === update.childGroup.slug) {
            cache.invalidate('Query', field.fieldKey)
          }
        })

        // Invalidate groups list queries to reflect relationship changes
        const groupsFields = cache.inspectFields('Query').filter((field) => field.fieldName === 'groups')
        groupsFields.forEach(field => {
          cache.invalidate('Query', field.fieldKey)
        })
      }
    }
  }
}
