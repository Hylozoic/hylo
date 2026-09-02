import { createSchema } from 'graphql-yoga'
import { GraphQLError } from 'graphql'
import { readFileSync } from 'fs'
import { join } from 'path'
import { merge, reduce } from 'lodash'
import setupBridge from '../../lib/graphql-bookshelf-bridge'
import { presentQuerySet } from '../../lib/graphql-bookshelf-bridge/util'
import mixpanel from '../../lib/mixpanel'
import {
  saveDraft,
  deleteDraft,
  acceptGroupRelationshipInvite,
  acceptJoinRequest,
  addGroupResponsibility,
  addGroupRole,
  addMember,
  addPeopleToProjectRole,
  addResponsibilityToRole,
  addProposalVote,
  addRoleToMember,
  addSkill,
  addSkillToLearn,
  addSuggestedSkillToGroup,
  addPostToView,
  allocateTokensToSubmission,
  allowGroupInvites,
  archiveSpace,
  blockUser,
  cancelGroupRelationshipInvite,
  cancelJoinRequest,
  clearModerationAction,
  completePost,
  convertGroupToSpace,
  convertSpaceToChildGroup,
  createAffiliation,
  createComment,
  createFundingRound,
  createGroup,
  createGroupView,
  createInvitation,
  createJoinRequest,
  createMessage,
  createModerationAction,
  createPost,
  createProject,
  createProjectRole,
  createSavedSearch,
  createSpace,
  createTrack,
  createZapierTrigger,
  login,
  createTopic,
  deactivateUser,
  deleteUser,
  declineJoinRequest,
  addEmailEnabledTester,
  removeEmailEnabledTester,
  deleteAffiliation,
  deleteComment,
  deleteFundingRound,
  deleteGroup,
  deleteGroupRelationship,
  deleteGroupResponsibility,
  deleteGroupTopic,
  deleteGroupView,
  deletePeerRelationship,
  deletePost,
  deleteProjectRole,
  deleteReaction,
  deleteSavedSearch,
  deleteSpace,
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
  joinSpace,
  leaveFundingRound,
  leaveGroup,
  muteMessageThread,
  unmuteMessageThread,
  leaveProject,
  leaveTrack,
  logout,
  markActivityRead,
  markAllActivitiesRead,
  markThreadRead,
  markThreadUnread,
  markViewAsRead,
  markGroupAsRead,
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
  removeMember,
  removePost,
  removePostFromView,
  removeResponsibilityFromRole,
  removeRoleFromMember,
  removeProposalVote,
  removeSkill,
  removeSkillToLearn,
  removeSuggestedSkillFromGroup,
  reorderGroupView,
  reorderViewPost,
  refundContentAccess,
  resendInvitation,
  respondToEvent,
  revokeContentAccess,
  savePost,
  sendEmailVerification,
  sendPasswordReset,
  setProposalOptions,
  setGroupViewHidden,
  setHomeView,
  subscribe,
  swapProposalVote,
  unblockUser,
  unfulfillPost,
  unlinkAccount,
  unsavePost,
  updateAllMemberships,
  updateComment,
  updateFundingRound,
  updateGroup,
  updateGroupResponsibility,
  updateGroupRole,
  updateGroupTopic,
  updateGroupTopicFollow,
  updateGroupView,
  updateGroupViewUser,
  updateTopicFollow,
  updateTrack,
  updateMe,
  updateMembership,
  updatePeerRelationship,
  updatePost,
  updateProposalOptions,
  updateProposalOutcome,
  updateSpace,
  updateStripeAccount,
  updateViewSettings,
  updateWidget,
  useInvitation,
  createStripeConnectedAccount,
  createStripeAccountLink,
  createStripeOffering,
  updateStripeOffering,
  createStripeCheckoutSession,
  checkStripeStatus,
  fulfillStripeCheckoutSession,
  membershipChangeCommit,
  verifyEmail
} from './mutations'
import {
  stripeAccountStatus,
  stripeOfferings,
  publicStripeOfferings,
  publicStripeOffering,
  offeringSubscriptionStats,
  offeringSubscribers,
  checkContentAccess,
  myTransactions,
  membershipChangeEligibleOfferings,
  membershipChangePreview,
  membershipChangeInvoicePreview
} from './queries'
import peopleTyping from './mutations/peopleTyping'
import InvitationService from '../services/InvitationService'
import makeModels from './makeModels'
import makeSubscriptions from './makeSubscriptions'

const schemaText = readFileSync(join(__dirname, 'schema.graphql')).toString()
let modelToTypeMap

/** Yoga calls makeSchema on every GraphQL request. Rebuilding that executable schema
 *  is the isolated-E2E OOM (heap hits the 4GB cap). Cache per auth identity; skip in
 *  unit tests so DataLoaders do not leak across cases. `GRAPHQL_CACHE_SCHEMA=0` disables. */
const SCHEMA_CACHE_MAX = 16
const schemaCache = new Map()

/**
 * Whether this process should reuse GraphQL schemas across requests.
 */
function shouldCacheGraphqlSchema () {
  if (process.env.GRAPHQL_CACHE_SCHEMA === '0') return false
  if (process.env.NODE_ENV === 'test') return false
  return true
}

/**
 * Cache key: filters and loaders close over userId / admin / API client.
 * @param {object} req
 */
function graphqlSchemaCacheKey (req) {
  const userId = req?.session?.userId || 'anon'
  const isAdmin = req && Admin.isSignedIn(req) ? '1' : '0'
  const apiClientId = req?.api_client?.id || req?.api_client?.client_id || ''
  return `${userId}|${isAdmin}|${apiClientId}`
}

/**
 * LRU insert; drops the oldest entry when over SCHEMA_CACHE_MAX.
 * @param {string} key
 * @param {object} schema
 */
function rememberGraphqlSchema (key, schema) {
  if (schemaCache.has(key)) schemaCache.delete(key)
  schemaCache.set(key, schema)
  while (schemaCache.size > SCHEMA_CACHE_MAX) {
    const oldest = schemaCache.keys().next().value
    schemaCache.delete(oldest)
  }
}

export default async function makeSchema ({ req }) {
  const cache = shouldCacheGraphqlSchema()
  const key = cache ? graphqlSchemaCacheKey(req) : null
  if (key && schemaCache.has(key)) {
    const cached = schemaCache.get(key)
    rememberGraphqlSchema(key, cached)
    return cached
  }
  const schema = await buildGraphqlSchema(req)
  if (key) rememberGraphqlSchema(key, schema)
  return schema
}

/**
 * Build a fresh executable schema for this request's identity.
 * @param {object} req
 */
async function buildGraphqlSchema (req) {
  const userId = req.session.userId
  const isAdmin = Admin.isSignedIn(req)
  const models = makeModels(userId, isAdmin, req.api_client)
  const { resolvers, fetchOne, fetchMany, loaders } = setupBridge(models)

  // Override GroupTopic and FundingRound resolvers to use DataLoaders for caching
  if (userId && loaders) {
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
    }
  }

  if (resolvers.Post && loaders?.tagByName) {
    resolvers.Post.topics = async (post) => {
      const names = post.tagNames ? post.tagNames() : (post.get('tag_names') || [])
      if (!names.length) return []
      const tags = await Promise.map(names, name => loaders.tagByName.load(name))
      return tags.filter(Boolean)
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

      ...makeUnionAndInterfaceResolvers(models)
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

/**
 * Invitation links must only bypass visibility for the group that issued them.
 * Otherwise a valid code/token for group A could fetch any other group by slug/id.
 */
function invitationMatchesGroupQuery (inviteCheck, slug, id) {
  if (!inviteCheck?.valid) return false
  if (slug) {
    return !!(inviteCheck.groupSlug && inviteCheck.groupSlug === slug) ||
      !!(inviteCheck.parentGroupSlug && inviteCheck.parentGroupSlug === slug)
  }
  if (id != null && id !== '') {
    return String(inviteCheck.groupId) === String(id) ||
      (inviteCheck.parentGroupId != null && String(inviteCheck.parentGroupId) === String(id))
  }
  return false
}

/**
 * Maps a Bookshelf model instance to its GraphQL type name from makeModels config.
 */
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

/**
 * Union / interface field resolvers that are not generated by the bookshelf bridge.
 */
export function makeUnionAndInterfaceResolvers (models) {
  return {
    FeedItemContent: {
      __resolveType (data, context, info) {
        if (data instanceof bookshelf.Model) {
          return info.schema.getType('Post')
        }
        throw new GraphQLError('Post is the only implemented FeedItemContent type')
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
        if (data?.makeModelsType) return data.makeModelsType

        const foundType = getTypeForInstance(data, models)
        if (foundType) return foundType
        throw new Error(`Unable to determine GraphQL type for SubscriptionUpdate: ${data}`)
      }
    }
  }
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
        if (invitationMatchesGroupQuery(inviteCheck, slug, id)) {
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
    comment: (root, { id }) => fetchOne('Comment', id),
    connections: (root, args) => fetchMany('PersonConnection', args),
    contentAccess: (root, args) => fetchMany('ContentAccess', args),
    fundingRound: (root, { id }) => fetchOne('FundingRound', id),
    group: async (root, { id, slug, updateLastViewed, accessCode, invitationToken }, context) => {
      let group
      // If invitation credentials are provided, validate and bypass visibility filter
      if (accessCode || invitationToken) {
        const inviteCheck = await InvitationService.check(invitationToken, accessCode)
        if (invitationMatchesGroupQuery(inviteCheck, slug, id)) {
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
    myDrafts: (root, args, context) =>
      Draft.where({ user_id: context.currentUserId }).orderBy('updated_at', 'desc').fetchAll(),

    draft: (root, { type, postId, groupId, topicId, messageThreadId, postType, isEdit }, context) =>
      Draft.findForContext(context.currentUserId, { type, postId, groupId, topicId, messageThreadId, postType, isEdit }),

    me: (root, args, context) => fetchOne('Me', context.currentUserId),
    myTransactions: (root, args, context) => myTransactions(context.currentUserId, args),
    membershipChangeEligibleOfferings: (root, { groupId }, context) =>
      membershipChangeEligibleOfferings(context.currentUserId, { groupId }),
    membershipChangePreview: (root, args, context) =>
      membershipChangePreview(context.currentUserId, args),
    membershipChangeInvoicePreview: (root, args, context) =>
      membershipChangeInvoicePreview(context.currentUserId, args),
    messageThread: (root, { id }) => {
      if (!id || isNaN(Number(id))) return null
      return fetchOne('MessageThread', id)
    },
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
        .then(({ models, hasMore }) => {
          // FIXME this shouldn't be used directly here -- there should be some
          // way of integrating this into makeModels and using the presentation
          // logic that's already in the fetcher
          return presentQuerySet(models, merge(args, { hasMore }))
        })
    },
    skills: (root, args) => fetchMany('Skill', args),
    stripeAccountStatus: (root, { groupId, accountId }, context) => stripeAccountStatus(context.currentUserId, { groupId, accountId }),
    stripeOfferings: (root, { groupId, accountId }, context) => stripeOfferings(context.currentUserId, { groupId, accountId }),
    publicStripeOfferings: (root, { groupId }) => publicStripeOfferings(null, { groupId }),
    publicStripeOffering: (root, { offeringId }) => publicStripeOffering(null, { offeringId }),
    offeringSubscriptionStats: (root, { offeringId, groupId }, context) => offeringSubscriptionStats(context.currentUserId, { offeringId, groupId }),
    offeringSubscribers: (root, { offeringId, groupId, page, pageSize, lapsedOnly }, context) => offeringSubscribers(context.currentUserId, { offeringId, groupId, page, pageSize, lapsedOnly }),
    // you can specify id or name, but not both
    topic: (root, { id, name }) => fetchOne('Topic', name || id, name ? 'name' : 'id'),
    topicFollow: async (root, { groupId, topicName }, context) => {
      if (!groupId || !topicName || !context.currentUserId) return null
      return TagFollow.query(q => {
        q.join('tags', 'tags.id', 'tag_follows.tag_id')
        q.where({
          'tag_follows.group_id': groupId,
          'tag_follows.user_id': context.currentUserId
        })
        q.whereRaw('lower(tags.name) = lower(?)', topicName)
      }).fetch()
    },
    topics: (root, args) => fetchMany('Topic', args),
    track: (root, { id }) => fetchOne('Track', id),
    emailEnabledTesters: async (root, args, context) => {
      if (!(await Admin.isTestAdmin(context.currentUserId))) {
        throw new GraphQLError('Unauthorized: Admin access required')
      }
      const testers = await EmailEnabledTester.findAll()
      return testers.toModelArray ? testers.toModelArray() : testers
    }
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
    createStripeCheckoutSession: (root, { groupId, offeringId, quantity, adjustableQuantity, successUrl, cancelUrl, metadata }) => createStripeCheckoutSession(null, { groupId, offeringId, quantity, adjustableQuantity, successUrl, cancelUrl, metadata })
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

    addPeopleToProjectRole: (root, { peopleIds, projectRoleId }, context) => addPeopleToProjectRole(context.currentUserId, peopleIds, projectRoleId),

    addProposalVote: (root, { postId, optionId }, context) => addProposalVote({ userId: context.currentUserId, postId, optionId }),

    addResponsibilityToRole: (root, { responsibilityId, roleId, groupId }, context) => addResponsibilityToRole({ userId: context.currentUserId, responsibilityId, roleId, groupId }),

    addRoleToMember: (root, { personId, roleId, groupId }, context) => addRoleToMember({ userId: context.currentUserId, personId, roleId, groupId }),

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

    refundContentAccess: (root, args, context) => refundContentAccess(context.currentUserId, args),

    recordStripePurchase: (root, args, context) => recordStripePurchase(context.currentUserId, args),

    createAffiliation: (root, { data }, context) => createAffiliation(context.currentUserId, data),

    createComment: (root, { data }, context) => createComment(context.currentUserId, data, context),

    createFundingRound: (root, { data }, context) => createFundingRound(context.currentUserId, data),

    createGroup: (root, { data }, context) => createGroup(context.currentUserId, data),

    createGroupView: (root, { groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, userId: viewUserId, hidden }, context) =>
      createGroupView({ userId: context.currentUserId, groupId, type, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, linkedGroupId, postId, viewUserId, hidden, context }),

    updateGroupView: (root, { id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd }, context) =>
      updateGroupView({ userId: context.currentUserId, id, name, icon, settings, link, pageContent, topics, orderInFrontOfViewId, addToEnd, context }),

    updateGroupViewUser: (root, { viewId, lastReadPostId }, context) =>
      updateGroupViewUser(context.currentUserId, viewId, { lastReadPostId }),

    deleteGroupView: (root, { id }, context) => deleteGroupView(context.currentUserId, id, context),

    reorderGroupView: (root, { id, orderInFrontOfViewId, addToEnd }, context) => reorderGroupView(context.currentUserId, id, orderInFrontOfViewId, addToEnd, context),

    setGroupViewHidden: (root, { id, hidden }, context) => setGroupViewHidden(context.currentUserId, id, hidden, context),

    setHomeView: (root, { viewId, groupId }, context) => setHomeView(context.currentUserId, viewId, groupId, context),

    markViewAsRead: (root, { viewId }, context) => markViewAsRead(context.currentUserId, viewId),

    markGroupAsRead: (root, { groupId }, context) => markGroupAsRead(context.currentUserId, groupId),

    updateViewSettings: (root, { viewId, settings }, context) => updateViewSettings(context.currentUserId, viewId, settings),

    addPostToView: (root, { viewId, postId, order }, context) => addPostToView(context.currentUserId, viewId, postId, order),

    removePostFromView: (root, { viewId, postId }, context) => removePostFromView(context.currentUserId, viewId, postId),

    reorderViewPost: (root, { viewId, postId, order }, context) => reorderViewPost(context.currentUserId, viewId, postId, order),

    createSpace: (root, { parentGroupId, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, purpose, location, locationId, viewTypes, bannerUrl, avatarUrl, paywall, addToMenu, status }, context) =>
      createSpace(context.currentUserId, { parentGroupId, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, purpose, location, locationId, viewTypes, bannerUrl, avatarUrl, paywall, addToMenu, status }, context),

    updateSpace: (root, { id, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, location, locationId, purpose, bannerUrl, avatarUrl, paywall, status }, context) =>
      updateSpace(context.currentUserId, { id, name, slug, acceptedPostTypes, visibility, accessibility, icon, description, requiredRoles, location, locationId, purpose, bannerUrl, avatarUrl, paywall, status }, context),

    archiveSpace: (root, { id }, context) => archiveSpace(context.currentUserId, id, context),

    deleteSpace: (root, { id }, context) => deleteSpace(context.currentUserId, id, context),

    convertSpaceToChildGroup: (root, { id }, context) =>
      convertSpaceToChildGroup(context.currentUserId, id, context),

    convertGroupToSpace: (root, { id, parentGroupId }, context) =>
      convertGroupToSpace(context.currentUserId, { id, parentGroupId }, context),

    joinSpace: (root, { spaceId, accessCode, invitationToken }, context) =>
      joinSpace(context.currentUserId, spaceId, accessCode, invitationToken),

    createInvitation: (root, { groupId, data }, context) => createInvitation(context.currentUserId, groupId, data), // consider sending locale from the frontend here

    createJoinRequest: (root, { groupId, questionAnswers }, context) => createJoinRequest(context.currentUserId, groupId, questionAnswers),

    createMessage: (root, { data }, context) => createMessage(context.currentUserId, data, context),

    createModerationAction: (root, { data }, context) => createModerationAction({ data, userId: context.currentUserId }),

    createPost: (root, { data }, context) => createPost(context.currentUserId, data, context),

    createProject: (root, { data }, context) => createProject(context.currentUserId, data, context),

    createProjectRole: (root, { projectId, roleName }, context) => createProjectRole(context.currentUserId, projectId, roleName),

    createSavedSearch: (root, { data }, context) => createSavedSearch(context.currentUserId, data),

    createTrack: (root, { data }, context) => createTrack(context.currentUserId, data),

    createZapierTrigger: (root, { groupIds, targetUrl, type, params }, context) => createZapierTrigger(context.currentUserId, groupIds, targetUrl, type, params),

    createTopic: (root, { topicName, groupId, isDefault, isSubscribing }, context) => createTopic(context.currentUserId, topicName, groupId, isDefault, isSubscribing),

    deactivateMe: (root, args, context) => deactivateUser({ sessionId: context.req.sessionId, userId: context.currentUserId }),

    declineJoinRequest: (root, { joinRequestId }, context) => declineJoinRequest(context.currentUserId, joinRequestId),

    deleteAffiliation: (root, { id }, context) => deleteAffiliation(context.currentUserId, id),

    deleteComment: (root, { id }, context) => deleteComment(context.currentUserId, id),

    deleteDraft: (root, { id }, context) => deleteDraft(context.currentUserId, id),

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

    deleteSavedSearch: (root, { id }, context) => deleteSavedSearch(context.currentUserId, id),

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

    muteMessageThread: (root, { messageThreadId }, context) => muteMessageThread(context.currentUserId, messageThreadId),

    unmuteMessageThread: (root, { messageThreadId }, context) => unmuteMessageThread(context.currentUserId, messageThreadId),

    leaveProject: (root, { id }, context) => leaveProject(id, context.currentUserId),

    leaveTrack: (root, { trackId }, context) => leaveTrack(context.currentUserId, trackId),

    markActivityRead: (root, { id }, context) => markActivityRead(context.currentUserId, id),

    markAllActivitiesRead: (root, args, context) => markAllActivitiesRead(context.currentUserId),

    markThreadRead,

    markThreadUnread,

    messageGroupStewards: (root, { groupId }, context) => messageGroupStewards(context.currentUserId, groupId),

    pinPost: (root, { postId, viewId }, context) => pinPost(context.currentUserId, postId, viewId),

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

    updateStripeOffering: (root, { offeringId, name, description, priceInCents, currency, accessGrants, renewalPolicy, duration, publishStatus }, context) => updateStripeOffering(context.currentUserId, { offeringId, name, description, priceInCents, currency, accessGrants, renewalPolicy, duration, publishStatus }),

    createStripeCheckoutSession: (root, { groupId, offeringId, quantity, adjustableQuantity, successUrl, cancelUrl, metadata }, context) => createStripeCheckoutSession(context.currentUserId, { groupId, offeringId, quantity, adjustableQuantity, successUrl, cancelUrl, metadata }),

    checkStripeStatus: (root, { groupId }, context) => checkStripeStatus(context.currentUserId, { groupId }),

    fulfillStripeCheckoutSession: (root, { sessionId, offeringId }, context) => fulfillStripeCheckoutSession(context.currentUserId, { sessionId, offeringId }),

    membershipChangeCommit: (root, { groupId, fromOfferingId, toOfferingId, newQuantity }, context) =>
      membershipChangeCommit(context.currentUserId, { groupId, fromOfferingId, toOfferingId, newQuantity }),

    reinviteAll: (root, { groupId }, context) => reinviteAll(context.currentUserId, groupId),

    rejectGroupRelationshipInvite: (root, { groupRelationshipInviteId }, context) => rejectGroupRelationshipInvite(context.currentUserId, groupRelationshipInviteId),

    removeMember: (root, { personId, groupId }, context) => removeMember(context.currentUserId, personId, groupId, context),

    removePost: (root, { postId, groupId, slug }, context) => removePost(context.currentUserId, postId, groupId || slug),

    removeResponsibilityFromRole: (root, { roleResponsibilityId, groupId }, context) => removeResponsibilityFromRole({ userId: context.currentUserId, roleResponsibilityId, groupId }),

    removeRoleFromMember: (root, { roleId, personId, groupId }, context) => removeRoleFromMember({ roleId, personId, userId: context.currentUserId, groupId }),

    removeProposalVote: (root, { postId, optionId }, context) => removeProposalVote({ userId: context.currentUserId, postId, optionId }),

    removeSkill: (root, { id, name }, context) => removeSkill(context.currentUserId, id || name),
    removeSkillToLearn: (root, { id, name }, context) => removeSkillToLearn(context.currentUserId, id || name),
    removeSuggestedSkillFromGroup: (root, { groupId, id, name }, context) => removeSuggestedSkillFromGroup(context.currentUserId, groupId, id || name),

    requestToAddGroupToParent: (root, { parentId, childId, questionAnswers }, context) =>
      inviteGroupToGroup(context.currentUserId, childId, parentId, GroupRelationshipInvite.TYPE.ChildToParent, questionAnswers),

    resendInvitation: (root, { invitationId }, context) => resendInvitation(context.currentUserId, invitationId),

    respondToEvent: (root, { id, response }, context) => respondToEvent(context.currentUserId, id, response),

    saveDraft: (root, { type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }, context) =>
      saveDraft(context.currentUserId, { type, data, postId, groupId, topicId, messageThreadId, postType, isEdit, navigateTo }),

    savePost: (root, { postId }, context) => savePost(context.currentUserId, postId),

    setProposalOptions: (root, { postId, options }, context) => setProposalOptions({ userId: context.currentUserId, postId, options }),

    subscribe: (root, { groupId, topicId, isSubscribing }, context) => subscribe(context.currentUserId, topicId, groupId, isSubscribing),

    swapProposalVote: (root, { postId, removeOptionId, addOptionId }, context) => swapProposalVote({ userId: context.currentUserId, postId, removeOptionId, addOptionId }),

    unblockUser: (root, { blockedUserId }, context) => unblockUser(context.currentUserId, blockedUserId),

    unfulfillPost: (root, { postId }, context) => unfulfillPost(context.currentUserId, postId),

    unlinkAccount: (root, { provider }, context) => unlinkAccount(context.currentUserId, provider),

    unsavePost: (root, { postId }, context) => unsavePost(context.currentUserId, postId),

    updateAllMemberships: (root, args, context) => updateAllMemberships(context.currentUserId, args),

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

    updateWidget: (root, { id, changes }, context) => updateWidget(id, changes),

    useInvitation: (root, { invitationToken, accessCode }, context) => useInvitation(context.currentUserId, invitationToken, accessCode),

    addEmailEnabledTester: (root, { userId }, context) => addEmailEnabledTester(context.currentUserId, userId),

    removeEmailEnabledTester: (root, { userId }, context) => removeEmailEnabledTester(context.currentUserId, userId)
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
