import { createSchema } from 'graphql-yoga'
import { GraphQLError } from 'graphql'
import { readFileSync } from 'fs'
import { join } from 'path'
import { merge, reduce } from 'lodash'
import setupBridge from '../../lib/graphql-bookshelf-bridge'
import { presentQuerySet } from '../../lib/graphql-bookshelf-bridge/util'
import mixpanel from '../../lib/mixpanel'
import {
  acceptGroupRelationshipInvite,
  acceptJoinRequest,
  addGroupResponsibility,
  addGroupRole,
  addMember,
  addModerator,
  addPeopleToProjectRole,
  addPostToCollection,
  addResponsibilityToRole,
  addProposalVote,
  addRoleToMember,
  addSkill,
  addSkillToLearn,
  addSuggestedSkillToGroup,
  allowGroupInvites,
  blockUser,
  cancelGroupRelationshipInvite,
  cancelJoinRequest,
  clearModerationAction,
  completePost,
  createAffiliation,
  createCollection,
  createComment,
  createContextWidget,
  createGroup,
  createInvitation,
  createJoinRequest,
  createMessage,
  createModerationAction,
  createPost,
  createProject,
  createProjectRole,
  createSavedSearch,
  createTrack,
  createZapierTrigger,
  login,
  createTopic,
  deactivateUser,
  deleteUser,
  declineJoinRequest,
  deleteAffiliation,
  deleteComment,
  deleteGroup,
  deleteGroupRelationship,
  deleteGroupResponsibility,
  deleteGroupTopic,
  deletePost,
  deleteProjectRole,
  deleteReaction,
  deleteSavedSearch,
  deleteZapierTrigger,
  duplicateTrack,
  enrollInTrack,
  expireInvitation,
  findOrCreateLinkPreviewByUrl,
  findOrCreateLocation,
  findOrCreateThread,
  flagInappropriateContent,
  fulfillPost,
  inviteGroupToGroup,
  invitePeopleToEvent,
  joinGroup,
  joinProject,
  leaveGroup,
  leaveProject,
  leaveTrack,
  logout,
  markActivityRead,
  markAllActivitiesRead,
  markThreadRead,
  messageGroupStewards,
  pinPost,
  processStripeToken,
  reactOn,
  reactivateUser,
  recordClickthrough,
  regenerateAccessCode,
  registerDevice,
  registerStripeAccount,
  reinviteAll,
  rejectGroupRelationshipInvite,
  register,
  removeWidgetFromMenu,
  removeMember,
  removeModerator,
  removePost,
  removePostFromCollection,
  removeResponsibilityFromRole,
  removeRoleFromMember,
  removeProposalVote,
  removeSkill,
  removeSkillToLearn,
  removeSuggestedSkillFromGroup,
  reorderContextWidget,
  reorderPostInCollection,
  resendInvitation,
  respondToEvent,
  sendEmailVerification,
  sendPasswordReset,
  setProposalOptions,
  setHomeWidget,
  subscribe,
  swapProposalVote,
  unblockUser,
  unfulfillPost,
  unlinkAccount,
  updateAllMemberships,
  updateComment,
  updateContextWidget,
  updateGroup,
  updateGroupResponsibility,
  updateGroupRole,
  updateGroupTopic,
  updateGroupTopicFollow,
  updateTopicFollow,
  updateTrack,
  updateTrackActionOrder,
  updateMe,
  updateMembership,
  updatePost,
  updateProposalOptions,
  updateProposalOutcome,
  updateStripeAccount,
  updateWidget,
  useInvitation,
  verifyEmail
} from './mutations'
import peopleTyping from './mutations/peopleTyping'
import InvitationService from '../services/InvitationService'
import makeModels from './makeModels'
import makeSubscriptions from './makeSubscriptions'

const schemaText = readFileSync(join(__dirname, 'schema.graphql')).toString()

export default async function makeSchema ({ req }) {
  const userId = req.session.userId
  const isAdmin = Admin.isSignedIn(req)
  const models = makeModels(userId, isAdmin, req.api_client)
  const { resolvers, fetchOne, fetchMany } = setupBridge(models)

  let allResolvers
  if (userId) {
    // authenticated users
    // TODO: look for api_client.scope to see what an oAuthed user is allowed to access

    mixpanel.people.set(userId)

    allResolvers = {
      Query: makeAuthenticatedQueries({ fetchOne, fetchMany }),
      Mutation: makeMutations({ fetchOne }),
      Subscription: makeSubscriptions(),

      // Custom Type resolvers

      FeedItemContent: {
        __resolveType (data, context, info) {
          if (data instanceof bookshelf.Model) {
            return info.schema.getType('Post')
          }
          throw new GraphQLError('Post is the only implemented FeedItemContent type')
        }
      },
      Role: {
        __resolveType (data, context, info) {
          return getTypeForInstance(data, models)
        }
      },
      SearchResultContent: {
        __resolveType (data, context, info) {
          return getTypeForInstance(data, models)
        }
      },
      // Type resolver for the Update graphql union type used in update subscription (see makeSubscriptions)
      Update: {
        __resolveType (data, context, info) {
          // Message and MessageThread are not the isDefaultTypeForTable for Comment and Post
          // in makeModels, and there is apparently no other way to infer the types, so the
          // correct type is set on makeModelsType by the subscription resolver to be used here
          if (data?.makeModelsType) return data.makeModelsType
          const foundType = getTypeForInstance(data, models)
          if (foundType) return foundType
          throw new Error(`Unable to determine GraphQL type for instance: ${data}`)
        }
      }
    }
  } else if (req.api_client) {
    // TODO: check scope here, just api:write, just api:read, or both?
    allResolvers = {
      Query: makeApiQueries({ fetchOne, fetchMany }),
      Mutation: makeApiMutations()
    }
  } else {
    // Not authenticated, only allow for public queries
    allResolvers = {
      Query: makePublicQueries({ fetchOne, fetchMany }),
      Mutation: makePublicMutations({ fetchOne })
    }
  }

  return createSchema({
    typeDefs: [schemaText],
    resolvers: Object.assign(allResolvers, resolvers)
  })
}

// Queries that non-logged in users can make
export function makePublicQueries ({ fetchOne, fetchMany }) {
  return {
    checkInvitation: (root, { invitationToken, accessCode }) =>
      InvitationService.check(invitationToken, accessCode),
    // Can only access public communities and posts
    group: async (root, { id, slug }) => fetchOne('Group', slug || id, slug ? 'slug' : 'id', { visibility: Group.Visibility.PUBLIC }),
    groups: (root, args) => fetchMany('Group', Object.assign(args, { visibility: Group.Visibility.PUBLIC })),
    platformAgreements: (root, args) => PlatformAgreement.fetchAll(args),
    post: (root, { id }) => fetchOne('Post', id, 'id', { isPublic: true }),
    posts: (root, args) => fetchMany('Post', Object.assign(args, { isPublic: true }))
  }
}

// Queries that logged in users can make
export function makeAuthenticatedQueries ({ fetchOne, fetchMany }) {
  return {
    activity: (root, { id }) => fetchOne('Activity', id),
    checkInvitation: (root, { invitationToken, accessCode }) =>
      InvitationService.check(invitationToken, accessCode),
    collection: (root, { id }) => fetchOne('Collection', id),
    comment: (root, { id }) => fetchOne('Comment', id),
    commonRoles: (root, args) => CommonRole.fetchAll(args),
    connections: (root, args) => fetchMany('PersonConnection', args),
    group: async (root, { id, slug, updateLastViewed }, context) => {
      // you can specify id or slug, but not both
      const group = await fetchOne('Group', slug || id, slug ? 'slug' : 'id')
      if (updateLastViewed && group) {
        // Resets new post count to 0
        await GroupMembership.updateLastViewedAt(context.currentUserId, group)
      }
      return group
    },
    groupExists: (root, { slug }) => {
      if (Group.isSlugValid(slug)) {
        return Group.where(bookshelf.knex.raw('slug = ?', slug))
          .count()
          .then(count => {
            if (count > 0) return { exists: true }
            return { exists: false }
          })
      }
      throw new GraphQLError('Slug is invalid')
    },
    groupExtension: (root, args) => fetchOne('GroupExtension', args),
    groupExtensions: (root, args) => fetchMany('GroupExtension', args),
    groupTopic: (root, { topicName, groupSlug }) => GroupTag.findByTagAndGroup(topicName, groupSlug),
    groupTopics: (root, args) => fetchMany('GroupTopic', args),
    groups: (root, args) => fetchMany('Group', args),
    joinRequests: (root, args) => fetchMany('JoinRequest', args),
    me: (root, args, context) => fetchOne('Me', context.currentUserId),
    messageThread: (root, { id }) => fetchOne('MessageThread', id),
    moderationActions: (root, args) => fetchMany('ModerationAction', args),
    notifications: async (root, { first, offset, resetCount, order = 'desc' }, context) => {
      const notifications = await fetchMany('Notification', { first, offset, order })
      resetCount && User.resetNewNotificationCount(context.currentUserId)
      return notifications
    },
    people: (root, args) => fetchMany('Person', args),
    // you can query by id or email, with id taking preference
    person: (root, { id, email }) => fetchOne('Person', id || email, id ? 'id' : 'email'),
    platformAgreements: (root, args) => PlatformAgreement.fetchAll(args),
    post: (root, { id }) => fetchOne('Post', id),
    posts: (root, args) => fetchMany('Post', args),
    responsibilities: (root, args) => Responsibility.fetchAll(args),
    savedSearches: (root, args) => fetchMany('SavedSearch', args),
    search: (root, args, context) => {
      if (!args.first) args.first = 20
      return Search.fullTextSearch(context.currentUserId, args)
        .then(({ models, total }) => {
          // FIXME this shouldn't be used directly here -- there should be some
          // way of integrating this into makeModels and using the presentation
          // logic that's already in the fetcher
          return presentQuerySet(models, merge(args, { total }))
        })
    },
    skills: (root, args) => fetchMany('Skill', args),
    // you can specify id or name, but not both
    topic: (root, { id, name }) => fetchOne('Topic', name || id, name ? 'name' : 'id'),
    topicFollow: (root, { groupId, topicName }, context) => TagFollow.findOrCreate({ groupId, topicName, userId: context.currentUserId }),
    topics: (root, args) => fetchMany('Topic', args),
    track: (root, { id }) => fetchOne('Track', id)
  }
}

export function makePublicMutations ({ fetchOne }) {
  return {
    login: login(fetchOne),
    logout,
    sendEmailVerification,
    sendPasswordReset,
    register: register(fetchOne),
    verifyEmail: verifyEmail(fetchOne)
  }
}

export function makeMutations ({ fetchOne }) {
  return {
    // Currently injecting all Public Mutations here so those resolvers remain
    // available between auth'd and non-auth'd sessions
    ...makePublicMutations({ fetchOne }),

    acceptGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => acceptGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    acceptJoinRequest: (root, { joinRequestId }, context) => acceptJoinRequest(context.currentUserId, joinRequestId),

    addGroupResponsibility: (root, { groupId, title, description }, context) => addGroupResponsibility({ userId: context.currentUserId, groupId, title, description }),

    addGroupRole: (root, { groupId, color, name, description, emoji }, context) => addGroupRole({ userId: context.currentUserId, groupId, color, name, description, emoji }),

    addModerator: (root, { personId, groupId }, context) => addModerator(context.currentUserId, personId, groupId),

    addPeopleToProjectRole: (root, { peopleIds, projectRoleId }, context) => addPeopleToProjectRole(context.currentUserId, peopleIds, projectRoleId),

    addPostToCollection: (root, { collectionId, postId }, context) => addPostToCollection(context.currentUserId, collectionId, postId),

    addProposalVote: (root, { postId, optionId }, context) => addProposalVote({ userId: context.currentUserId, postId, optionId }),

    addResponsibilityToRole: (root, { responsibilityId, roleId, groupId }, context) => addResponsibilityToRole({ userId: context.currentUserId, responsibilityId, roleId, groupId }),

    addRoleToMember: (root, { personId, roleId, groupId, isCommonRole = false }, context) => addRoleToMember({ userId: context.currentUserId, personId, roleId, groupId, isCommonRole }),

    addSkill: (root, { name }, context) => addSkill(context.currentUserId, name),

    addSkillToLearn: (root, { name }, context) => addSkillToLearn(context.currentUserId, name),

    addSuggestedSkillToGroup: (root, { groupId, name }, context) => addSuggestedSkillToGroup(context.currentUserId, groupId, name),

    allowGroupInvites: (root, { groupId, data }) => allowGroupInvites(groupId, data),

    blockUser: (root, { blockedUserId }, context) => blockUser(context.currentUserId, blockedUserId),

    cancelGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => cancelGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    cancelJoinRequest: (root, { joinRequestId }, context) => cancelJoinRequest(context.currentUserId, joinRequestId),

    clearModerationAction: (root, { postId, groupId, moderationActionId }, context) => clearModerationAction({ userId: context.currentUserId, postId, groupId, moderationActionId }),

    completePost: (root, { postId, completionResponse }, context) => completePost(context.currentUserId, postId, completionResponse),

    createAffiliation: (root, { data }, context) => createAffiliation(context.currentUserId, data),

    createCollection: (root, { data }, context) => createCollection(context.currentUserId, data),

    createComment: (root, { data }, context) => createComment(context.currentUserId, data, context),

    createContextWidget: (root, { groupId, data }, context) => createContextWidget({ userId: context.currentUserId, groupId, data }),

    createGroup: (root, { data }, context) => createGroup(context.currentUserId, data),

    createInvitation: (root, { groupId, data }, context) => createInvitation(context.currentUserId, groupId, data), // consider sending locale from the frontend here

    createJoinRequest: (root, { groupId, questionAnswers }, context) => createJoinRequest(context.currentUserId, groupId, questionAnswers),

    createMessage: (root, { data }, context) => createMessage(context.currentUserId, data, context),

    createModerationAction: (root, { data }, context) => createModerationAction({ data, userId: context.currentUserId }),

    createPost: (root, { data }, context) => createPost(context.currentUserId, data, context),

    createProject: (root, { data }, context) => createProject(context.currentUserId, data, context),

    createProjectRole: (root, { projectId, roleName }, context) => createProjectRole(context.currentUserId, projectId, roleName),

    createSavedSearch: (root, { data }) => createSavedSearch(data),

    createTrack: (root, { data }, context) => createTrack(context.currentUserId, data),

    createZapierTrigger: (root, { groupIds, targetUrl, type, params }, context) => createZapierTrigger(context.currentUserId, groupIds, targetUrl, type, params),

    joinGroup: (root, { groupId, questionAnswers }, context) => joinGroup(groupId, context.currentUserId, questionAnswers),

    joinProject: (root, { id }, context) => joinProject(id, context.currentUserId),

    createTopic: (root, { topicName, groupId, isDefault, isSubscribing }, context) => createTopic(context.currentUserId, topicName, groupId, isDefault, isSubscribing),

    deactivateMe: (root, args, context) => deactivateUser({ sessionId: context.req.sessionId, userId: context.currentUserId }),

    declineJoinRequest: (root, { joinRequestId }, context) => declineJoinRequest(context.currentUserId, joinRequestId),

    deleteAffiliation: (root, { id }, context) => deleteAffiliation(context.currentUserId, id),

    deleteComment: (root, { id }, context) => deleteComment(context.currentUserId, id),

    deleteGroup: (root, { id }, context) => deleteGroup(context.currentUserId, id),

    deleteGroupRelationship: (root, { parentId, childId }, context) => deleteGroupRelationship(context.currentUserId, parentId, childId),

    deleteGroupResponsibility: (root, { responsibilityId, groupId }, context) => deleteGroupResponsibility({ userId: context.currentUserId, responsibilityId, groupId }),

    deleteGroupTopic: (root, { id }, context) => deleteGroupTopic(context.currentUserId, id),

    deleteMe: (root, args, context) => deleteUser({ sessionId: context.req.sessionId, userId: context.currentUserId }),

    deletePost: (root, { id }, context) => deletePost(context.currentUserId, id),

    deleteProjectRole: (root, { id }, context) => deleteProjectRole(context.currentUserId, id),

    deleteReaction: (root, { entityId, data }, context) => deleteReaction(context.currentUserId, entityId, data),

    deleteSavedSearch: (root, { id }, context) => deleteSavedSearch(id),

    deleteZapierTrigger: (root, { id }, context) => deleteZapierTrigger(context.currentUserId, id),

    duplicateTrack: (root, { trackId }, context) => duplicateTrack(context.currentUserId, trackId),

    enrollInTrack: (root, { trackId }, context) => enrollInTrack(context.currentUserId, trackId),

    expireInvitation: (root, { invitationId }, context) => expireInvitation(context.currentUserId, invitationId),

    findOrCreateThread: (root, { data }, context) => findOrCreateThread(context.currentUserId, data.participantIds),

    findOrCreateLinkPreviewByUrl: (root, { data }, context) => findOrCreateLinkPreviewByUrl(data),

    findOrCreateLocation: (root, { data }, context) => findOrCreateLocation(data),

    flagInappropriateContent: (root, { data }, context) => flagInappropriateContent(context.currentUserId, data),

    fulfillPost: (root, { postId }, context) => fulfillPost(context.currentUserId, postId),

    inviteGroupToJoinParent: (root, { parentId, childId }, context) => inviteGroupToGroup(context.currentUserId, parentId, childId, GroupRelationshipInvite.TYPE.ParentToChild),

    invitePeopleToEvent: (root, { eventId, inviteeIds }, context) => invitePeopleToEvent(context.currentUserId, eventId, inviteeIds),

    leaveGroup: (root, { id }, context) => leaveGroup(context.currentUserId, id),

    leaveProject: (root, { id }, context) => leaveProject(id, context.currentUserId),

    leaveTrack: (root, { trackId }, context) => leaveTrack(context.currentUserId, trackId),

    markActivityRead: (root, { id }, context) => markActivityRead(context.currentUserId, id),

    markAllActivitiesRead: (root, args, context) => markAllActivitiesRead(context.currentUserId),

    markThreadRead,

    messageGroupStewards: (root, { groupId }, context) => messageGroupStewards(context.currentUserId, groupId),

    pinPost: (root, { postId, groupId }, context) => pinPost(context.currentUserId, postId, groupId),

    peopleTyping,

    processStripeToken: (root, { postId, token, amount }, context) => processStripeToken(context.currentUserId, postId, token, amount),

    reactOn: (root, { entityId, data }, context) => reactOn(context.currentUserId, entityId, data),

    reactivateMe: (root, context) => reactivateUser({ userId: context.currentUserId }),

    recordClickthrough: (root, { postId }, context) => recordClickthrough({ userId: context.currentUserId, postId }),

    regenerateAccessCode: (root, { groupId }, context) => regenerateAccessCode(context.currentUserId, groupId),

    registerDevice: (root, { playerId, platform, version }, context) => registerDevice(context.currentUserId, { playerId, platform, version }),

    registerStripeAccount: (root, { authorizationCode }, context) => registerStripeAccount(context.currentUserId, authorizationCode),

    reinviteAll: (root, { groupId }, context) => reinviteAll(context.currentUserId, groupId),

    rejectGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => rejectGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    removeWidgetFromMenu: (root, { contextWidgetId, groupId }, context) => removeWidgetFromMenu({ userId: context.currentUserId, contextWidgetId, groupId }),

    removeMember: (root, { personId, groupId }, context) => removeMember(context.currentUserId, personId, groupId),

    removeModerator: (root, { personId, groupId, isRemoveFromGroup }, context) => removeModerator(context.currentUserId, personId, groupId, isRemoveFromGroup),

    removePost: (root, { postId, groupId, slug }, context) => removePost(context.currentUserId, postId, groupId || slug),

    removePostFromCollection: (root, { collectionId, postId }, context) => removePostFromCollection(context.currentUserId, collectionId, postId),

    removeResponsibilityFromRole: (root, { roleResponsibilityId, groupId }, context) => removeResponsibilityFromRole({ userId: context.currentUserId, roleResponsibilityId, groupId }),

    removeRoleFromMember: (root, { roleId, personId, groupId, isCommonRole }, context) => removeRoleFromMember({ roleId, personId, userId: context.currentUserId, groupId, isCommonRole }),

    removeProposalVote: (root, { postId, optionId }, context) => removeProposalVote({ userId: context.currentUserId, postId, optionId }),

    removeSkill: (root, { id, name }, context) => removeSkill(context.currentUserId, id || name),
    removeSkillToLearn: (root, { id, name }, context) => removeSkillToLearn(context.currentUserId, id || name),
    removeSuggestedSkillFromGroup: (root, { groupId, id, name }, context) => removeSuggestedSkillFromGroup(context.currentUserId, groupId, id || name),

    reorderContextWidget: (root, { contextWidgetId, parentId, orderInFrontOfWidgetId, addToEnd }, context) =>
      reorderContextWidget({ userId: context.currentUserId, contextWidgetId, parentId, orderInFrontOfWidgetId, addToEnd }),

    reorderPostInCollection: (root, { collectionId, postId, newOrderIndex }, context) =>
      reorderPostInCollection(context.currentUserId, collectionId, postId, newOrderIndex),

    requestToAddGroupToParent: (root, { parentId, childId, questionAnswers }, context) =>
      inviteGroupToGroup(context.currentUserId, childId, parentId, GroupRelationshipInvite.TYPE.ChildToParent, questionAnswers),

    resendInvitation: (root, { invitationId }, context) => resendInvitation(context.currentUserId, invitationId),

    respondToEvent: (root, { id, response }, context) => respondToEvent(context.currentUserId, id, response),

    setProposalOptions: (root, { postId, options }, context) => setProposalOptions({ userId: context.currentUserId, postId, options }),

    setHomeWidget: (root, { contextWidgetId, groupId }, context) => setHomeWidget({ userId: context.currentUserId, contextWidgetId, groupId }),

    subscribe: (root, { groupId, topicId, isSubscribing }, context) => subscribe(context.currentUserId, topicId, groupId, isSubscribing),

    swapProposalVote: (root, { postId, removeOptionId, addOptionId }, context) => swapProposalVote({ userId: context.currentUserId, postId, removeOptionId, addOptionId }),

    unblockUser: (root, { blockedUserId }, context) => unblockUser(context.currentUserId, blockedUserId),

    unfulfillPost: (root, { postId }, context) => unfulfillPost(context.currentUserId, postId),

    unlinkAccount: (root, { provider }, context) => unlinkAccount(context.currentUserId, provider),

    updateAllMemberships: (root, args, context) => updateAllMemberships(context.currentUserId, args),

    updateContextWidget: (root, { contextWidgetId, data }, context) => updateContextWidget({ userId: context.currentUserId, contextWidgetId, data }),

    updateGroupResponsibility: (root, { groupId, responsibilityId, title, description }, context) =>
      updateGroupResponsibility({ userId: context.currentUserId, groupId, responsibilityId, title, description }),

    updateGroupRole: (root, { groupRoleId, color, name, description, emoji, active, groupId }, context) =>
      updateGroupRole({ userId: context.currentUserId, groupRoleId, color, name, description, emoji, active, groupId }),

    updateGroupSettings: (root, { id, changes }, context) => updateGroup(context.currentUserId, id, changes),

    updateGroupTopic: (root, { id, data }, context) => updateGroupTopic(id, data),

    updateGroupTopicFollow: (root, args, context) => updateGroupTopicFollow(context.currentUserId, args),

    updateTopicFollow: (root, args, context) => updateTopicFollow(context.currentUserId, args),

    updateMe: (root, { changes }, context) => updateMe(context.req.sessionId, context.currentUserId, changes),

    updateMembership: (root, args, context) => updateMembership(context.currentUserId, args),

    updatePost: (root, args, context) => updatePost(context.currentUserId, args),

    updateProposalOptions: (root, { postId, options }, context) => updateProposalOptions({ userId: context.currentUserId, postId, options }),

    updateProposalOutcome: (root, { postId, proposalOutcome }, context) => updateProposalOutcome({ userId: context.currentUserId, postId, proposalOutcome }),

    updateComment: (root, args, context) => updateComment(context.currentUserId, args, context),

    updateStripeAccount: (root, { accountId }, context) => updateStripeAccount(context.currentUserId, accountId),

    updateTrack: (root, { trackId, data }, context) => updateTrack(context.currentUserId, trackId, data),

    updateTrackActionOrder: (root, { trackId, postId, newOrderIndex }, context) => updateTrackActionOrder(context.currentUserId, trackId, postId, newOrderIndex),

    updateWidget: (root, { id, changes }, context) => updateWidget(id, changes),

    useInvitation: (root, { invitationToken, accessCode }, context) => useInvitation(context.currentUserId, invitationToken, accessCode)
  }
}

export function makeApiQueries ({ fetchOne, fetchMany }) {
  return {
    // you can specify id or slug, but not both
    group: async (root, { id, slug }) => fetchOne('Group', slug || id, slug ? 'slug' : 'id'),
    groups: (root, args) => fetchMany('Group', args),
    // you can query by id or email, with id taking preference
    person: (root, { id, email }) => fetchOne('Person', id || email, id ? 'id' : 'email')
  }
}

export function makeApiMutations () {
  return {
    addMember: (root, { userId, groupId, role }) => addMember(userId, groupId, role),
    createGroup: (root, { asUserId, data }) => createGroup(asUserId, data),
    updateGroup: (root, { asUserId, id, changes }) => updateGroup(asUserId, id, changes)
  }
}

let modelToTypeMap

export function getTypeForInstance (instance, models) {
  if (!modelToTypeMap) {
    modelToTypeMap = reduce(models, (m, v, k) => {
      const tableName = v.model.forge().tableName
      if (!m[tableName] || v.isDefaultTypeForTable) {
        m[tableName] = k
      }
      return m
    }, {})
  }

  return modelToTypeMap[instance.tableName]
}

function logError (error) {
  console.error(error.stack)

  return {
    message: error.message,
    locations: error.locations,
    stack: error.stack,
    path: error.path
  }
}
