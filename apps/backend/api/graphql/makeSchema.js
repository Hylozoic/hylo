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
  allocateTokensToSubmission,
  allowGroupInvites,
  blockUser,
  cancelGroupRelationshipInvite,
  cancelJoinRequest,
  checkContentAccess,
  clearModerationAction,
  completePost,
  createAffiliation,
  createCollection,
  createComment,
  createContextWidget,
  createFundingRound,
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
  deleteContextWidget,
  deleteFundingRound,
  deleteGroup,
  deleteGroupRelationship,
  deleteGroupResponsibility,
  deleteGroupTopic,
  deletePeerRelationship,
  deletePost,
  deleteProjectRole,
  deleteReaction,
  deleteSavedSearch,
  deleteZapierTrigger,
  doPhaseTransition,
  duplicateTrack,
  enrollInTrack,
  expireInvitation,
  findOrCreateLinkPreviewByUrl,
  findOrCreateLocation,
  findOrCreateThread,
  flagInappropriateContent,
  fulfillPost,
  grantContentAccess,
  inviteGroupToGroup,
  invitePeerRelationship,
  invitePeopleToEvent,
  joinFundingRound,
  joinGroup,
  joinProject,
  leaveFundingRound,
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
  recordStripePurchase,
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
  revokeContentAccess,
  savePost,
  sendEmailVerification,
  sendPasswordReset,
  setProposalOptions,
  setHomeWidget,
  subscribe,
  swapProposalVote,
  unblockUser,
  unfulfillPost,
  unlinkAccount,
  unsavePost,
  updateAllMemberships,
  updateComment,
  updateContextWidget,
  updateFundingRound,
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
  updatePeerRelationship,
  updatePost,
  updateProposalOptions,
  updateProposalOutcome,
  updateStripeAccount,
  updateWidget,
  useInvitation,
  createStripeConnectedAccount,
  createStripeAccountLink,
  stripeAccountStatus,
  createStripeOffering,
  updateStripeOffering,
  stripeOfferings,
  publicStripeOfferings,
  publicStripeOffering,
  createStripeCheckoutSession,
  checkStripeStatus,
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
  const { resolvers, fetchOne, fetchMany, loaders } = setupBridge(models)

  // Override Track, GroupTopic, and FundingRound resolvers to use DataLoaders for caching
  if (userId && loaders) {
    if (resolvers.Track) {
      resolvers.Track.isEnrolled = async (track) => {
        if (!track || !userId) return null
        const trackUser = await loaders.trackUser.load({ trackId: track.get('id'), userId })
        return trackUser && trackUser.get('enrolled_at') !== null
      }
      resolvers.Track.didComplete = async (track) => {
        if (!track || !userId) return null
        const trackUser = await loaders.trackUser.load({ trackId: track.get('id'), userId })
        return trackUser && trackUser.get('completed_at') !== null
      }
      resolvers.Track.userSettings = async (track) => {
        if (!track || !userId) return null
        const trackUser = await loaders.trackUser.load({ trackId: track.get('id'), userId })
        return trackUser ? trackUser.get('settings') : null
      }
    }

    if (resolvers.GroupTopic) {
      resolvers.GroupTopic.isSubscribed = async (groupTag) => {
        if (!groupTag || !userId) return null
        const tagFollow = await loaders.tagFollow.load({
          groupId: groupTag.get('group_id'),
          tagId: groupTag.get('tag_id'),
          userId
        })
        return tagFollow !== null
      }
      resolvers.GroupTopic.lastReadPostId = async (groupTag) => {
        if (!groupTag || !userId) return null
        const tagFollow = await loaders.tagFollow.load({
          groupId: groupTag.get('group_id'),
          tagId: groupTag.get('tag_id'),
          userId
        })
        return tagFollow ? tagFollow.get('last_read_post_id') : null
      }
      resolvers.GroupTopic.newPostCount = async (groupTag) => {
        if (!groupTag || !userId) return 0
        const tagFollow = await loaders.tagFollow.load({
          groupId: groupTag.get('group_id'),
          tagId: groupTag.get('tag_id'),
          userId
        })
        return tagFollow ? tagFollow.get('new_post_count') : 0
      }
    }

    if (resolvers.FundingRound) {
      resolvers.FundingRound.isParticipating = async (fundingRound) => {
        if (!fundingRound || !userId) return null
        const roundUser = await loaders.fundingRoundUser.load({ fundingRoundId: fundingRound.get('id'), userId })
        return !!roundUser
      }
      resolvers.FundingRound.userSettings = async (fundingRound) => {
        if (!fundingRound || !userId) return null
        const roundUser = await loaders.fundingRoundUser.load({ fundingRoundId: fundingRound.get('id'), userId })
        return roundUser ? roundUser.get('settings') : null
      }
      resolvers.FundingRound.tokensRemaining = async (fundingRound) => {
        if (!fundingRound || !userId) return null
        const roundUser = await loaders.fundingRoundUser.load({ fundingRoundId: fundingRound.get('id'), userId })
        return roundUser ? roundUser.get('tokens_remaining') : null
      }
    }
  }

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
      },
      // Type resolver for the SubscriptionUpdate union type used in allUpdates subscription
      SubscriptionUpdate: {
        __resolveType (data, context, info) {
          // Use makeModelsType if set by the subscription resolver
          if (data?.makeModelsType) return data.makeModelsType

          const foundType = getTypeForInstance(data, models)
          if (foundType) return foundType
          throw new Error(`Unable to determine GraphQL type for SubscriptionUpdate: ${data}`)
        }
      }
    }
  } else if (req.api_client) {
    // TODO: check scope here, just api:write, just api:read, or both?
    allResolvers = {
      Query: makeApiQueries({ fetchOne, fetchMany }),
      Mutation: makeApiMutations(),
      // Provide Subscription resolvers even for API clients; resolvers self-guard on auth
      Subscription: makeSubscriptions()
    }
  } else {
    // Not authenticated, only allow for public queries
    allResolvers = {
      Query: makePublicQueries({ fetchOne, fetchMany }),
      Mutation: makePublicMutations({ fetchOne }),
      // Supply Subscription resolvers. They handle unauthenticated requests gracefully
      Subscription: makeSubscriptions()
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
    // Can only access public communities and posts, unless a valid invitation is provided
    group: async (root, { id, slug, accessCode, invitationToken }) => {
      // If invitation credentials are provided, validate and bypass visibility filter
      if (accessCode || invitationToken) {
        const inviteCheck = await InvitationService.check(invitationToken, accessCode)
        if (inviteCheck?.valid) {
          // Fetch group without visibility restriction
          return Group.where(slug ? { slug } : { id }).where({ active: true }).fetch()
        }
      }
      // Default: only allow PUBLIC visibility groups
      return fetchOne('Group', slug || id, slug ? 'slug' : 'id', { visibility: Group.Visibility.PUBLIC })
    },
    groups: (root, args) => fetchMany('Group', Object.assign(args, { visibility: Group.Visibility.PUBLIC })),
    platformAgreements: (root, args) => PlatformAgreement.fetchAll(args),
    post: (root, { id }) => fetchOne('Post', id, 'id', { isPublic: true }),
    posts: (root, args) => fetchMany('Post', Object.assign(args, { isPublic: true })),
    publicStripeOfferings: (root, { groupId }) => publicStripeOfferings(null, { groupId }),
    publicStripeOffering: (root, { offeringId }) => publicStripeOffering(null, { offeringId })
  }
}

// Queries that logged in users can make
export function makeAuthenticatedQueries ({ fetchOne, fetchMany }) {
  return {
    activity: (root, { id }) => fetchOne('Activity', id),
    checkContentAccess: (root, args, context) => checkContentAccess(context.currentUserId, args),
    checkInvitation: (root, { invitationToken, accessCode }) =>
      InvitationService.check(invitationToken, accessCode),
    collection: (root, { id }) => fetchOne('Collection', id),
    comment: (root, { id }) => fetchOne('Comment', id),
    commonRoles: (root, args) => CommonRole.fetchAll(args),
    connections: (root, args) => fetchMany('PersonConnection', args),
    contentAccess: (root, args) => fetchMany('ContentAccess', args),
    fundingRound: (root, { id }) => fetchOne('FundingRound', id),
    group: async (root, { id, slug, updateLastViewed, accessCode, invitationToken }, context) => {
      let group
      // If invitation credentials are provided, validate and bypass visibility filter
      if (accessCode || invitationToken) {
        const inviteCheck = await InvitationService.check(invitationToken, accessCode)
        if (inviteCheck?.valid) {
          // Fetch group directly without normal visibility filter
          group = await Group.where(slug ? { slug } : { id }).where({ active: true }).fetch()
        }
      }
      // Default: use normal fetch with group filter applied
      if (!group) {
        group = await fetchOne('Group', slug || id, slug ? 'slug' : 'id')
      }
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
      resetCount && await User.resetNewNotificationCount(context.currentUserId)
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
    stripeAccountStatus: (root, { groupId, accountId }, context) => stripeAccountStatus(context.currentUserId, { groupId, accountId }),
    stripeOfferings: (root, { groupId, accountId }, context) => stripeOfferings(context.currentUserId, { groupId, accountId }),
    publicStripeOfferings: (root, { groupId }) => publicStripeOfferings(null, { groupId }),
    publicStripeOffering: (root, { offeringId }) => publicStripeOffering(null, { offeringId }),
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
    verifyEmail: verifyEmail(fetchOne),
    createStripeCheckoutSession: (root, { groupId, offeringId, quantity, successUrl, cancelUrl, metadata }) => createStripeCheckoutSession(null, { groupId, offeringId, quantity, successUrl, cancelUrl, metadata })
  }
}

export function makeMutations ({ fetchOne }) {
  return {
    // Currently injecting all Public Mutations here so those resolvers remain
    // available between auth'd and non-auth'd sessions
    ...makePublicMutations({ fetchOne }),

    acceptGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => acceptGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId, context),

    acceptJoinRequest: (root, { joinRequestId }, context) => acceptJoinRequest(context.currentUserId, joinRequestId),

    addGroupResponsibility: (root, { groupId, title, description }, context) => addGroupResponsibility({ userId: context.currentUserId, groupId, title, description }),

    addGroupRole: (root, { groupId, color, name, description, emoji }, context) => addGroupRole({ userId: context.currentUserId, groupId, color, name, description, emoji }),

    addModerator: (root, { personId, groupId }, context) => addModerator(context.currentUserId, personId, groupId, context),

    addPeopleToProjectRole: (root, { peopleIds, projectRoleId }, context) => addPeopleToProjectRole(context.currentUserId, peopleIds, projectRoleId),

    addPostToCollection: (root, { collectionId, postId }, context) => addPostToCollection(context.currentUserId, collectionId, postId),

    addProposalVote: (root, { postId, optionId }, context) => addProposalVote({ userId: context.currentUserId, postId, optionId }),

    addResponsibilityToRole: (root, { responsibilityId, roleId, groupId }, context) => addResponsibilityToRole({ userId: context.currentUserId, responsibilityId, roleId, groupId }),

    addRoleToMember: (root, { personId, roleId, groupId, isCommonRole = false }, context) => addRoleToMember({ userId: context.currentUserId, personId, roleId, groupId, isCommonRole }),

    addSkill: (root, { name }, context) => addSkill(context.currentUserId, name),

    addSkillToLearn: (root, { name }, context) => addSkillToLearn(context.currentUserId, name),

    addSuggestedSkillToGroup: (root, { groupId, name }, context) => addSuggestedSkillToGroup(context.currentUserId, groupId, name),

    allocateTokensToSubmission: (root, { postId, tokens }, context) => allocateTokensToSubmission(context.currentUserId, postId, tokens),

    allowGroupInvites: (root, { groupId, data }) => allowGroupInvites(groupId, data),

    blockUser: (root, { blockedUserId }, context) => blockUser(context.currentUserId, blockedUserId),

    cancelGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => cancelGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    cancelJoinRequest: (root, { joinRequestId }, context) => cancelJoinRequest(context.currentUserId, joinRequestId),

    clearModerationAction: (root, { postId, groupId, moderationActionId }, context) => clearModerationAction({ userId: context.currentUserId, postId, groupId, moderationActionId }),

    completePost: (root, { postId, completionResponse }, context) => completePost(context.currentUserId, postId, completionResponse),

    grantContentAccess: (root, args, context) => grantContentAccess(context.currentUserId, args),

    revokeContentAccess: (root, args, context) => revokeContentAccess(context.currentUserId, args),

    recordStripePurchase: (root, args, context) => recordStripePurchase(context.currentUserId, args),

    createAffiliation: (root, { data }, context) => createAffiliation(context.currentUserId, data),

    createCollection: (root, { data }, context) => createCollection(context.currentUserId, data),

    createComment: (root, { data }, context) => createComment(context.currentUserId, data, context),

    createContextWidget: (root, { groupId, data }, context) => createContextWidget({ userId: context.currentUserId, groupId, data }),

    createFundingRound: (root, { data }, context) => createFundingRound(context.currentUserId, data),

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

    createTopic: (root, { topicName, groupId, isDefault, isSubscribing }, context) => createTopic(context.currentUserId, topicName, groupId, isDefault, isSubscribing),

    deactivateMe: (root, args, context) => deactivateUser({ sessionId: context.req.sessionId, userId: context.currentUserId }),

    declineJoinRequest: (root, { joinRequestId }, context) => declineJoinRequest(context.currentUserId, joinRequestId),

    deleteAffiliation: (root, { id }, context) => deleteAffiliation(context.currentUserId, id),

    deleteComment: (root, { id }, context) => deleteComment(context.currentUserId, id),

    deleteContextWidget: (root, { contextWidgetId }, context) => deleteContextWidget(context.currentUserId, contextWidgetId),

    deleteFundingRound: (root, { id }, context) => deleteFundingRound(context.currentUserId, id),

    deleteGroup: (root, { id }, context) => deleteGroup(context.currentUserId, id),

    deleteGroupRelationship: (root, { parentId, childId }, context) => deleteGroupRelationship(context.currentUserId, parentId, childId, context),

    deletePeerRelationship: (root, { relationshipId }, context) => deletePeerRelationship(context.currentUserId, relationshipId, context),

    deleteGroupResponsibility: (root, { responsibilityId, groupId }, context) => deleteGroupResponsibility({ userId: context.currentUserId, responsibilityId, groupId }),

    deleteGroupTopic: (root, { id }, context) => deleteGroupTopic(context.currentUserId, id),

    deleteMe: (root, args, context) => deleteUser({ sessionId: context.req.sessionId, userId: context.currentUserId }),

    deletePost: (root, { id }, context) => deletePost(context.currentUserId, id),

    deleteProjectRole: (root, { id }, context) => deleteProjectRole(context.currentUserId, id),

    deleteReaction: (root, { entityId, data }, context) => deleteReaction(context.currentUserId, entityId, data, context),

    deleteSavedSearch: (root, { id }, context) => deleteSavedSearch(id),

    deleteZapierTrigger: (root, { id }, context) => deleteZapierTrigger(context.currentUserId, id),

    doPhaseTransition: (root, { id }, context) => doPhaseTransition(context.currentUserId, id),

    duplicateTrack: (root, { trackId }, context) => duplicateTrack(context.currentUserId, trackId),

    enrollInTrack: (root, { trackId }, context) => enrollInTrack(context.currentUserId, trackId),

    expireInvitation: (root, { invitationId }, context) => expireInvitation(context.currentUserId, invitationId),

    findOrCreateThread: (root, { data }, context) => findOrCreateThread(context.currentUserId, data.participantIds),

    findOrCreateLinkPreviewByUrl: (root, { data }, context) => findOrCreateLinkPreviewByUrl(data),

    findOrCreateLocation: (root, { data }, context) => findOrCreateLocation(data),

    flagInappropriateContent: (root, { data }, context) => flagInappropriateContent(context.currentUserId, data),

    fulfillPost: (root, { postId }, context) => fulfillPost(context.currentUserId, postId),

    inviteGroupToJoinParent: (root, { parentId, childId }, context) => inviteGroupToGroup(context.currentUserId, parentId, childId, GroupRelationshipInvite.TYPE.ParentToChild),

    invitePeerRelationship: (root, { fromGroupId, toGroupId, description }, context) => invitePeerRelationship(context.currentUserId, fromGroupId, toGroupId, description, context),

    invitePeopleToEvent: (root, { eventId, inviteeIds }, context) => invitePeopleToEvent(context.currentUserId, eventId, inviteeIds),

    joinFundingRound: (root, { id }, context) => joinFundingRound(context.currentUserId, id),

    joinGroup: (root, { groupId, questionAnswers, accessCode, invitationToken, acceptAgreements }, context) => joinGroup(groupId, context.currentUserId, questionAnswers, accessCode, invitationToken, acceptAgreements, context),

    joinProject: (root, { id }, context) => joinProject(id, context.currentUserId),

    leaveFundingRound: (root, { id }, context) => leaveFundingRound(context.currentUserId, id),

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

    reactOn: (root, { entityId, data }, context) => reactOn(context.currentUserId, entityId, data, context),

    reactivateMe: (root, context) => reactivateUser({ userId: context.currentUserId }),

    recordClickthrough: (root, { postId }, context) => recordClickthrough({ userId: context.currentUserId, postId }),

    regenerateAccessCode: (root, { groupId }, context) => regenerateAccessCode(context.currentUserId, groupId),

    // DEPRECATED: This is no longer used, remove after 2025-08-26
    registerDevice: () => registerDevice(),

    registerStripeAccount: (root, { authorizationCode }, context) => registerStripeAccount(context.currentUserId, authorizationCode),

    createStripeConnectedAccount: (root, { groupId, email, businessName, country, existingAccountId }, context) => createStripeConnectedAccount(context.currentUserId, { groupId, email, businessName, country, existingAccountId }),

    createStripeAccountLink: (root, { groupId, accountId, returnUrl, refreshUrl }, context) => createStripeAccountLink(context.currentUserId, { groupId, accountId, returnUrl, refreshUrl }),

    createStripeOffering: (root, { input }, context) => createStripeOffering(context.currentUserId, input),

    updateStripeOffering: (root, { offeringId, name, description, priceInCents, currency, contentAccess, renewalPolicy, duration, publishStatus }, context) => updateStripeOffering(context.currentUserId, { offeringId, name, description, priceInCents, currency, contentAccess, renewalPolicy, duration, publishStatus }),

    createStripeCheckoutSession: (root, { groupId, offeringId, quantity, successUrl, cancelUrl, metadata }, context) => createStripeCheckoutSession(context.currentUserId, { groupId, offeringId, quantity, successUrl, cancelUrl, metadata }),

    checkStripeStatus: (root, { groupId }, context) => checkStripeStatus(context.currentUserId, { groupId }),

    reinviteAll: (root, { groupId }, context) => reinviteAll(context.currentUserId, groupId),

    rejectGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => rejectGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    removeWidgetFromMenu: (root, { contextWidgetId, groupId }, context) => removeWidgetFromMenu({ userId: context.currentUserId, contextWidgetId, groupId }),

    removeMember: (root, { personId, groupId }, context) => removeMember(context.currentUserId, personId, groupId, context),

    removeModerator: (root, { personId, groupId, isRemoveFromGroup }, context) => removeModerator(context.currentUserId, personId, groupId, isRemoveFromGroup, context),

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

    savePost: (root, { postId }, context) => savePost(context.currentUserId, postId),

    setProposalOptions: (root, { postId, options }, context) => setProposalOptions({ userId: context.currentUserId, postId, options }),

    setHomeWidget: (root, { contextWidgetId, groupId }, context) => setHomeWidget({ userId: context.currentUserId, contextWidgetId, groupId }),

    subscribe: (root, { groupId, topicId, isSubscribing }, context) => subscribe(context.currentUserId, topicId, groupId, isSubscribing),

    swapProposalVote: (root, { postId, removeOptionId, addOptionId }, context) => swapProposalVote({ userId: context.currentUserId, postId, removeOptionId, addOptionId }),

    unblockUser: (root, { blockedUserId }, context) => unblockUser(context.currentUserId, blockedUserId),

    unfulfillPost: (root, { postId }, context) => unfulfillPost(context.currentUserId, postId),

    unlinkAccount: (root, { provider }, context) => unlinkAccount(context.currentUserId, provider),

    unsavePost: (root, { postId }, context) => unsavePost(context.currentUserId, postId),

    updateAllMemberships: (root, args, context) => updateAllMemberships(context.currentUserId, args),

    updateContextWidget: (root, { contextWidgetId, data }, context) => updateContextWidget({ userId: context.currentUserId, contextWidgetId, data }),

    updateFundingRound: (root, { id, data }, context) => updateFundingRound(context.currentUserId, id, data),

    updateGroupResponsibility: (root, { groupId, responsibilityId, title, description }, context) =>
      updateGroupResponsibility({ userId: context.currentUserId, groupId, responsibilityId, title, description }),

    updateGroupRole: (root, { groupRoleId, color, name, description, emoji, active, groupId }, context) =>
      updateGroupRole({ userId: context.currentUserId, groupRoleId, color, name, description, emoji, active, groupId }),

    updateGroupSettings: (root, { id, changes }, context) => updateGroup(context.currentUserId, id, changes, context),

    updateGroupTopic: (root, { id, data }, context) => updateGroupTopic(id, data),

    updateGroupTopicFollow: (root, args, context) => updateGroupTopicFollow(context.currentUserId, args),

    updateTopicFollow: (root, args, context) => updateTopicFollow(context.currentUserId, args),

    updateMe: (root, { changes }, context) => updateMe(context.req.sessionId, context.currentUserId, changes),

    updateMembership: (root, args, context) => updateMembership(context.currentUserId, args),

    updatePeerRelationship: (root, { relationshipId, description }, context) => updatePeerRelationship(context.currentUserId, relationshipId, description, context),

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
