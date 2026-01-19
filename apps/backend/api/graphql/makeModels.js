/* global FundingRound ContentAccess */
import { camelCase, isNil, mapKeys, startCase } from 'lodash/fp'
import pluralize from 'pluralize'
import { TextHelpers } from '@hylo/shared'
import searchQuerySet from './searchQuerySet'
import {
  commentFilter,
  groupFilter,
  groupTopicFilter,
  makeFilterToggle,
  membershipFilter,
  messageFilter,
  personFilter,
  postFilter,
  reactionFilter
} from './filters'
import { LOCATION_DISPLAY_PRECISION } from '../../lib/constants'
import InvitationService from '../services/InvitationService'
import {
  filterAndSortContentAccess,
  filterAndSortPosts,
  filterAndSortUsers
} from '../services/Search/util'
const { createGroupRoleScope } = require('../../lib/scopes')

// this defines what subset of attributes and relations in each Bookshelf model
// should be exposed through GraphQL, and what query filters should be applied
// based on the current user's access rights.
//
// keys in the returned object are GraphQL schema type names
//
export default function makeModels (userId, isAdmin, apiClient) {
  const nonAdminFilter = makeFilterToggle(!isAdmin)

  // XXX: for now give super API users more access, in the future track which groups each client can access
  const apiFilter = makeFilterToggle(!apiClient || !apiClient.super)

  return {
    Agreement: {
      model: Agreement,
      isDefaultTypeForTable: true,
      attributes: [
        'id',
        'description',
        'order',
        'title'
      ],
      getters: {
        order: a => a.pivot && a.pivot.get('order')
      }
    },

    CookieConsent: {
      model: CookieConsent,
      attributes: [
        'id',
        'consent_id',
        'user_id',
        'settings',
        'version',
        'updated_at'
      ],
      relations: [
        'user'
      ],
      getters: {
        userId: c => c.get('user_id'),
        consentId: c => c.get('consent_id')
      }
    },

    CommonRole: {
      model: CommonRole,
      attributes: [
        'id',
        'name',
        'description',
        'emoji'
      ],
      relations: [
        { responsibilities: { querySet: true } }
      ],
      fetchMany: () => CommonRole.fetchAll()
    },

    ContextWidget: {
      model: ContextWidget,
      attributes: [
        'id',
        'auto_added',
        'title',
        'type',
        'order',
        'visibility',
        'view',
        'icon',
        'created_at',
        'parent_id',
        'updated_at',
        'secondaryNumber'
      ],
      relations: [
        'customView',
        'ownerGroup',
        'parentWidget',
        { children: { alias: 'childWidgets', querySet: true } },
        'viewGroup',
        'viewPost',
        'viewUser',
        'viewChat',
        'viewFundingRound',
        'viewTrack'
      ],
      getters: {
        // XXX: has to be a getter not a relation because belongsTo doesn't support multiple keys
        groupTopic: cw => cw.groupTopic().fetch(),
        highlightNumber: cw => cw.highlightNumber(userId),
        topicFollow: cw => cw.topicFollow(userId).fetch()
      },
      fetchMany: ({ groupId, includeUnordered }) => {
        return ContextWidget.collection().query(q => {
          q.where({ group_id: groupId })
          if (!includeUnordered) {
            q.whereNotNull('order')
          }
          q.orderBy('order', 'asc')
        })
      }
    },

    Me: {
      model: User,
      attributes: [
        'id',
        'avatar_url',
        'banner_url',
        'bio',
        'email',
        'contact_email',
        'contact_phone',
        'created_at',
        'email_validated',
        'hasRegistered',
        'intercomHash',
        'linkedin_url',
        'location',
        'facebook_url',
        'name',
        'new_notification_count',
        'tagline',
        'twitter_name',
        'updated_at',
        'url'
      ],
      relations: [
        'groups',
        'memberships',
        'posts',
        'locationObject',
        { groupRoles: { querySet: true } },
        { affiliations: { querySet: true } },
        { groupInvitesPending: { querySet: true } },
        {
          joinRequests: {
            querySet: true,
            filter: (relation, { status }) =>
              relation.query(q => {
                if (typeof status !== 'undefined') {
                  q.where('status', status)
                }
              })
          }
        },
        { skills: { querySet: true } },
        { skillsToLearn: { querySet: true } },
        {
          membershipCommonRoles: {
            querySet: true,
            filter: (relation, { groupId }) => {
              return relation.query(q => {
                if (groupId) {
                  q.where('group_id', groupId)
                }
              })
            }
          }
        },
        { messageThreads: { typename: 'MessageThread', querySet: true } },
        { tagFollows: { alias: 'topicFollows', querySet: true } },
        { tracksEnrolledIn: { querySet: true } },
        { cookieConsent: { alias: 'cookieConsentPreferences' } }
      ],
      getters: {
        blockedUsers: u => u.blockedUsers().fetch(),
        hasStripeAccount: u => u.hasStripeAccount(),
        isAdmin: () => isAdmin || false,
        rsvpCalendarUrl: u => u.rsvpCalendarUrl(),
        settings: u => mapKeys(camelCase, u.get('settings'))
      }
    },

    Membership: {
      model: GroupMembership,
      attributes: [
        'created_at',
        'expires_at',
        'group_id',
        'nav_order'
      ],
      relations: [
        { agreements: { querySet: true } },
        { group: { alias: 'group' } },
        { user: { alias: 'person' } },
        { commonRoles: { querySet: true } },
        { membershipCommonRoles: { querySet: true } },
        { joinQuestionAnswers: { querySet: true } },
        { tagFollows: { alias: 'topicFollows', querySet: true } }
      ],
      getters: {
        settings: m => mapKeys(camelCase, m.get('settings')),
        lastViewedAt: m =>
          m.get('user_id') === userId ? m.getSetting('lastReadAt') : null,
        newPostCount: m =>
          m.get('user_id') === userId ? m.get('new_post_count') : null,
        hasModeratorRole: m => m.hasRole(GroupMembership.Role.MODERATOR) // TODO RESP: verify
      },
      filter: nonAdminFilter(membershipFilter(userId))
    },

    MembershipAgreement: {
      model: Agreement,
      attributes: [
        'id',
        'accepted'
      ],
      getters: {
        accepted: a => a.pivot && a.pivot.get('accepted')
      }
    },

    MembershipCommonRole: {
      model: MemberCommonRole,
      attributes: [
        'id',
        'group_id',
        'common_role_id',
        'user_id'
      ],
      relations: [
        'commonRole',
        'group',
        'user'
      ],
      getters: {
        roleId: mcr => mcr.get('common_role_id')
      }
    },

    MembershipGroupRole: {
      model: MemberGroupRole,
      attributes: [
        'id',
        'expires_at',
        'group_id',
        'group_role_id',
        'user_id'
      ],
      relations: [
        'group',
        'groupRole',
        'user'
      ],
      getters: {
        roleId: mcr => mcr.get('group_role_id')
      }
    },

    ModerationAction: {
      model: ModerationAction,
      attributes: [
        'status',
        'text',
        'anonymous',
        'groupId',
        'created_at',
        'updated_at'
      ],
      relations: ['post', 'reporter', 'agreements', 'platformAgreements'],
      getters: {
        anonymous: ma => ma.get('anonymous') === 'true'
      },
      fetchMany: ({ first = 20, offset = 0, slug, sortBy }) =>
        searchQuerySet('forModerationActions', {
          first, offset, currentUserId: userId, slug, sortBy
        })
    },

    Person: {
      model: User,
      attributes: [
        'name',
        'avatar_url',
        'banner_url',
        'bio',
        'contact_email',
        'contact_phone',
        'twitter_name',
        'linkedin_url',
        'facebook_url',
        'url',
        'last_active_at',
        'location',
        'tagline'
      ],
      getters: {
        completedAt: p => p.pivot && p.pivot.get('completed_at'), // When loading through a track this is when they completed the track
        enrolledAt: p => p.pivot && p.pivot.get('enrolled_at'), // When loading through a track this is when they were enrolled in the track
        messageThreadId: p => p.getMessageThreadWith(userId).then(post => post ? post.id : null)
      },
      relations: [
        'memberships',
        {
          membershipCommonRoles: {
            querySet: true,
            filter: (relation, { groupId }) => {
              return relation.query(q => {
                if (groupId) {
                  q.where('group_id', groupId)
                }
              })
            }
          }
        },
        {
          groupJoinQuestionAnswers: {
            querySet: true,
            filter: (relation, args, context, info) => {
              return relation.query(q => {
                const groupId = args.groupId
                  ? [args.groupId]
                  : Group.query(q => {
                    q.select('id')
                    q.where({ slug: args.slug })
                  }).query()
                return q.whereIn('group_join_questions_answers.group_id', groupId)
              })
            }
          }
        },
        'moderatedGroupMemberships', // TODO: still need this?
        'locationObject',
        { groupRoles: { querySet: true } },
        { commonRoles: { querySet: true } },
        { affiliations: { querySet: true } },
        { eventsAttending: { querySet: true } },
        // This fix is required for web and mobile, to avoid action posts showing up in member profiles
        {
          posts: {
            querySet: true,
            filter: (relation, {
              activePostsOnly = false,
              afterTime,
              announcementsOnly,
              beforeTime,
              boundingBox,
              collectionToFilterOut,
              context,
              createdBy,
              cursor,
              filter,
              forCollection,
              groupSlugs,
              interactedWithBy,
              isFulfilled,
              mentionsOf,
              offset,
              order,
              savedBy,
              search,
              sortBy,
              topic,
              topics,
              types
            }) =>
              relation.query(filterAndSortPosts({
                activePostsOnly,
                afterTime,
                announcementsOnly,
                beforeTime,
                boundingBox,
                collectionToFilterOut,
                context,
                createdBy,
                cursor,
                forCollection,
                groupSlugs,
                interactedWithBy,
                isFulfilled,
                mentionsOf,
                offset,
                order,
                savedBy,
                search,
                showPinnedFirst: false,
                sortBy,
                topic,
                topics,
                type: filter,
                types
              }))
          }
        },
        { projects: { querySet: true } },
        { comments: { querySet: true } },
        { skills: { querySet: true } },
        { skillsToLearn: { querySet: true } },
        { reactions: { querySet: true } }
      ],
      filter: nonAdminFilter(apiFilter(personFilter(userId))),
      isDefaultTypeForTable: true,
      fetchMany: ({ boundingBox, first, order, sortBy, offset, search, autocomplete, groupIds, filter }) =>
        searchQuerySet('users', {
          boundingBox,
          term: search,
          limit: first,
          offset,
          order,
          type: filter,
          autocomplete,
          groups: groupIds,
          sort: sortBy
        })
    },

    PlatformAgreement: {
      model: PlatformAgreement,
      attributes: [
        'id',
        'description',
        'text',
        'type'
      ]
    },

    Post: {
      model: Post,
      attributes: [
        'accept_contributions',
        'announcement',
        'anonymous_voting',
        'budget',
        'commentersTotal',
        'commentsTotal',
        'completion_action_settings',
        'completion_action',
        'created_at',
        'donations_link',
        'edited_at',
        'end_time',
        'flagged_groups',
        'fulfilled_at',
        'is_public',
        'link_preview_featured',
        'location',
        'num_people_completed',
        'project_management_link',
        'proposal_outcome',
        'proposal_status',
        'quorum',
        'reactions_summary',
        'start_time',
        'timezone',
        'type',
        'updated_at',
        'voting_method'
      ],
      getters: {
        clickthrough: p => p.clickthroughForUser(userId),
        commenters: (p, { first }) => p.getCommenters(first, userId),
        completedAt: p => p.completedAtForUser(userId),
        completionResponse: p => p.completionResponseForUser(userId),
        details: p => p.details(userId),
        fundingRound: p => p.fundingRounds().fetchOne(),
        isAnonymousVote: p => p.get('anonymous_voting') === 'true',
        localId: p => p.getLocalId(),
        myReactions: p => userId ? p.reactionsForUser(userId).fetch() : [],
        myEventResponse: p =>
          userId && p.isEvent()
            ? p.userEventInvitation(userId).then(eventInvitation => eventInvitation ? eventInvitation.get('response') : '')
            : '',
        savedAt: p => p.savedAtForUser(userId),
        sortOrder: p => p.pivot && p.pivot.get('sort_order'), // For loading posts in order in a track
        tokensAllocated: async p => {
          if (!userId) return null
          const postUser = await PostUser.find(p.get('id'), userId)
          return postUser ? postUser.get('tokens_allocated_to') || 0 : 0
        },
        totalTokensAllocated: async p => {
          const result = await bookshelf.knex('posts_users')
            .where('post_id', p.get('id'))
            .sum('tokens_allocated_to as total')
            .first()
          return result?.total ? parseInt(result.total) : 0
        }
      },
      relations: [
        { comments: { querySet: true } },
        {
          completionResponses: {
            querySet: true,
            filter: (relation) => {
              return relation.query(async q => {
                const postUsers = await PostMembership.where({ post_id: relation.relatedData.parentId }).fetchAll()
                const hasTracksResponsibility = postUsers.length > 0 && await Promise.any(postUsers.map(postUser => {
                  return GroupMembership.hasResponsibility(userId, postUser.get('group_id'), Responsibility.constants.RESP_MANAGE_TRACKS)
                }))
                if (!hasTracksResponsibility) return q.where('user_id', userId)
                return q
              })
            }
          }
        },
        'groups',
        { user: { alias: 'creator' } },
        'followers',
        'locationObject',
        { members: { querySet: true } },
        { eventInvitations: { querySet: true } },
        { moderationActions: { querySet: true } },
        { proposalOptions: { querySet: true } },
        { proposalVotes: { querySet: true } },
        'linkPreview',
        'postMemberships',
        {
          reactions: {
            alias: 'postReactions'
          }
        },
        {
          media: {
            alias: 'attachments',
            arguments: ({ type }) => [type]
          }
        },
        { tags: { alias: 'topics' } }
      ],
      filter: postFilter(userId, isAdmin),
      isDefaultTypeForTable: true,
      fetchMany: ({
        activePostsOnly = false,
        afterTime,
        announcementsOnly,
        beforeTime,
        boundingBox,
        collectionToFilterOut,
        context,
        createdBy,
        cursor,
        filter,
        first,
        forCollection,
        groupSlugs,
        interactedWithBy,
        isFulfilled,
        mentionsOf,
        offset,
        order,
        proposalOutcome,
        proposalStatus,
        savedBy,
        sortBy,
        search,
        topic,
        topics,
        types
      }) =>
        searchQuerySet('posts', {
          activePostsOnly,
          afterTime,
          announcementsOnly,
          beforeTime,
          boundingBox,
          collectionToFilterOut,
          currentUserId: userId,
          cursor,
          forCollection,
          groupSlugs,
          interactedWithBy,
          isFulfilled,
          limit: first,
          mentionsOf,
          offset,
          onlyMyGroups: context === 'all' || context === 'my',
          onlyPublic: context === 'public',
          order,
          proposalOutcome,
          proposalStatus,
          savedBy,
          sort: sortBy,
          term: search,
          topic,
          topics,
          type: filter,
          types,
          users: createdBy
        })
    },

    Group: {
      model: Group,
      attributes: [
        'about_video_uri',
        'accessibility',
        'allow_in_public',
        'avatar_url',
        'banner_url',
        'created_at',
        'description',
        'homeWidget',
        'location',
        'geo_shape',
        'memberCount',
        'name',
        'paywall',
        'postCount',
        'purpose',
        'slug',
        'stripe_account_id',
        'stripe_charges_enabled',
        'stripe_payouts_enabled',
        'stripe_details_submitted',
        'type',
        'visibility',
        'website_url',
        'welcome_page'
      ],
      relations: [
        { activeMembers: { querySet: true } },
        { agreements: { querySet: true } },
        { chatRooms: { querySet: true } },
        { childGroups: { querySet: true } },
        { contextWidgets: { querySet: true } },
        { customViews: { querySet: true } },
        { groupRelationshipInvitesFrom: { querySet: true } },
        { groupRelationshipInvitesTo: { querySet: true } },
        { groupRoles: { querySet: true } },
        {
          groupTags: {
            querySet: true,
            alias: 'groupTopics',
            filter: (relation, { autocomplete, subscribed, groupId, groupIds }) =>
              relation.query(groupTopicFilter(userId, {
                autocomplete,
                subscribed,
                groupId: relation.relatedData.parentId || groupId,
                groupIds
              }))
          }
        },
        { groupToGroupJoinQuestions: { querySet: true } },
        { joinQuestions: { querySet: true } },
        { moderators: { querySet: true } },
        { stewards: { querySet: true } },
        {
          memberships: {
            querySet: true,
            filter: (relation, { userId }) =>
              relation.query(q => {
                if (userId) {
                  q.where('group_memberships.user_id', userId)
                }
              })
          }
        },
        {
          members: {
            querySet: true,
            filter: (relation, { id, autocomplete, boundingBox, groupRoleId, order, search, sortBy, commonRoleId }) =>
              relation.query(filterAndSortUsers({ autocomplete, boundingBox, groupId: relation.relatedData.parentId, groupRoleId, order, search, sortBy, commonRoleId }))
          }
        },
        { parentGroups: { querySet: true } },
        { peerGroups: { querySet: true } },
        { peerGroupRelationships: { querySet: true } },
        {
          posts: {
            querySet: true,
            filter: (relation, {
              activePostsOnly = false,
              afterTime,
              beforeTime,
              boundingBox,
              collectionToFilterOut,
              cursor,
              forCollection,
              filter,
              isAnnouncement,
              isFulfilled,
              order,
              search,
              sortBy,
              topic,
              topics,
              types
            }) =>
              relation.query(filterAndSortPosts({
                activePostsOnly,
                afterTime,
                beforeTime,
                boundingBox,
                collectionToFilterOut,
                cursor,
                forCollection,
                isAnnouncement,
                isFulfilled,
                order,
                search,
                showPinnedFirst: false, // XXX: we have removed pinning for now, but plan to bring back.
                sortBy,
                topic,
                topics,
                type: filter,
                types
              }))
          }
        },
        {
          prerequisiteGroups: {
            querySet: true,
            filter: (relation, { onlyNotMember }) =>
              relation.query(q => {
                if (onlyNotMember && userId) {
                  // Only return prerequisite groups that the current user is not yet a member of
                  q.whereNotIn('groups.id', GroupMembership.query().select('group_id').where({
                    'group_memberships.user_id': userId,
                    'group_memberships.active': true
                  }))
                }
              })
          }
        },
        {
          skills: {
            querySet: true,
            filter: (relation, { autocomplete }) =>
              relation.query(q => {
                if (autocomplete) {
                  q.whereRaw('skills.name ilike ?', autocomplete + '%')
                }
              })
          }
        },
        { suggestedSkills: { querySet: true } },
        {
          tracks: {
            querySet: true,
            filter: (relation, { autocomplete, published, sortBy, order }) =>
              relation.query(q => {
                if (autocomplete) {
                  q.whereRaw('tracks.name ilike ?', autocomplete + '%')
                }

                if (!isNil(published)) {
                  if (published) {
                    q.whereNotNull('tracks.published_at')
                  } else {
                    q.whereNull('tracks.published_at')
                  }
                }

                q.orderBy(sortBy || 'id', order || 'asc')

                // Only admins can see unpublished tracks
                if (!GroupMembership.hasResponsibility(userId, relation.relatedData.parentId, Responsibility.constants.RESP_ADMINISTRATION)) {
                  q.whereNotNull('tracks.published_at')
                }
              })
          }
        },
        {
          fundingRounds: {
            querySet: true,
            filter: (relation, { sortBy, order }) =>
              relation.query(q => {
                q.where('deactivated_at', null)
                q.orderBy(sortBy || 'id', order || 'asc')
              })
          }
        },
        {
          contentAccess: {
            querySet: true,
            filter: (relation, { search, accessType, status, offeringId, trackId, roleId, sortBy, order }) =>
              relation.query(filterAndSortContentAccess({
                groupIds: [relation.relatedData.parentId],
                search,
                accessType,
                status,
                offeringId,
                trackId,
                roleId,
                sortBy,
                order
              }))
          }
        },
        {
          viewPosts: {
            querySet: true,
            arguments: () => [userId],
            filter: (relation, { activePostsOnly = false, afterTime, beforeTime, boundingBox, collectionToFilterOut, filter, forCollection, isFulfilled, order, search, sortBy, topic, topics, types }) =>
              relation.query(filterAndSortPosts({
                activePostsOnly,
                afterTime,
                beforeTime,
                boundingBox,
                collectionToFilterOut,
                forCollection,
                isFulfilled,
                order,
                search,
                showPinnedFirst: false, // XXX: we have removed pinning for now, but plan to bring back.
                sortBy,
                topic,
                topics,
                type: filter,
                types
              }))
          }
        },
        { widgets: { querySet: true } },
        { groupExtensions: { querySet: true } }
      ],
      getters: {
        // commonRoles: async g => g.commonRoles(),
        canAccess: g => g ? g.canAccess(userId) : false,
        homeWidget: g => g.homeWidget(),
        stripeDashboardUrl: g => g.stripeDashboardUrl(),
        invitePath: g =>
          userId && GroupMembership.hasResponsibility(userId, g, Responsibility.constants.RESP_ADD_MEMBERS)
            .then(canInvite => canInvite ? Frontend.Route.invitePath(g) : null),
        location: async (g) => {
          // If location obfuscation is on then non group stewards see a display string that only includes city, region & country
          const precision = g.getSetting('location_display_precision') || LOCATION_DISPLAY_PRECISION.Precise
          if (precision === LOCATION_DISPLAY_PRECISION.Precise ||
                (userId && await GroupMembership.hasResponsibility(userId, g, Responsibility.constants.RESP_ADMINISTRATION))) {
            return g.get('location')
          } else {
            const locObj = await g.locationObject().fetch()
            if (locObj) {
              let display = locObj.get('country')
              if (locObj.get('region')) {
                display = locObj.get('region') + ', ' + display
              }
              if (locObj.get('city')) {
                display = locObj.get('city') + ', ' + display
              }
              return display
            }
          }
          return null
        },
        locationObject: async (g) => {
          // If precision is precise or user is an administrator of the group show the exact location
          const precision = g.getSetting('location_display_precision') || LOCATION_DISPLAY_PRECISION.Precise
          if (precision === LOCATION_DISPLAY_PRECISION.Precise ||
                (userId && await GroupMembership.hasResponsibility(userId, g, Responsibility.constants.RESP_ADMINISTRATION))) {
            // TODO: add RESP for this
            return g.locationObject().fetch()
          } else if (precision === LOCATION_DISPLAY_PRECISION.Near) {
            // For near only include region, city, country columns, and move the exact location around every load
            const columns = [
              'id',
              bookshelf.knex.raw('ST_Translate(center, random()*.03 - .03, random()*.03 -.03) as center'),
              'city',
              'locality',
              'region',
              'neighborhood',
              'postcode',
              'country',
              'accuracy',
              'wikidata'
            ]
            return g.locationObject().query(q => q.select(columns)).fetch()
          } else {
            // if location display precision is "region" then don't return the location object at all
            return null
          }
        },
        // XXX: Flag for translation
        moderatorDescriptor: (g) => g.get('steward_descriptor') || 'Steward',
        moderatorDescriptorPlural: (g) => g.get('steward_descriptor_plural') || 'Stewards',
        stewardDescriptor: (g) => g.get('steward_descriptor') || 'Steward',
        stewardDescriptorPlural: (g) => g.get('steward_descriptor_plural') || 'Stewards',
        // Get number of prerequisite groups that current user is not a member of yet
        numPrerequisitesLeft: g => g.numPrerequisitesLeft(userId),
        pendingInvitations: (g, { first }) => InvitationService.find({ groupId: g.id, pendingOnly: true }),
        responsibilities: async g => g.availableResponsibilities().fetch(),
        settings: g => mapKeys(camelCase, g.get('settings')),
        // XXX: Flag for translation
        typeDescriptor: g => g.get('type_descriptor') || (g.get('type') ? startCase(g.get('type')) : 'Group'),
        typeDescriptorPlural: g => g.get('type_descriptor_plural') || (g.get('type') ? pluralize(startCase(g.get('type'))) : 'Groups')
      },
      filter: nonAdminFilter(apiFilter(groupFilter(userId))),
      fetchMany: ({ allowedInPublic, autocomplete, boundingBox, context, farmQuery, filter, first, groupIds, groupType, nearCoord, offset, onlyMine, order, parentSlugs, search, sortBy, visibility }) =>
        searchQuerySet('groups', {
          allowedInPublic,
          autocomplete,
          boundingBox,
          currentUserId: userId,
          farmQuery,
          groupIds,
          groupType,
          limit: first,
          nearCoord,
          offset,
          onlyMine: context === 'all',
          order,
          parentSlugs,
          sort: sortBy,
          term: search,
          type: filter,
          visibility: context === 'public' ? Group.Visibility.PUBLIC : visibility
        })
    },

    GroupJoinQuestion: {
      model: GroupJoinQuestion,
      attributes: [
        'questionId',
        'text'
      ]
    },

    GroupJoinQuestionAnswer: {
      model: GroupJoinQuestionAnswer,
      isDefaultTypeForTable: true,
      attributes: [
        'answer'
      ],
      relations: ['group', 'question', 'user']
    },

    GroupToGroupJoinQuestion: {
      model: GroupToGroupJoinQuestion,
      attributes: [
        'questionId',
        'text'
      ]
    },

    GroupRelationship: {
      model: GroupRelationship,
      attributes: [
        'created_at',
        'description',
        'relationship_type',
        'role',
        'updated_at'
      ],
      relations: ['childGroup', 'parentGroup']
    },

    GroupRelationshipInvite: {
      model: GroupRelationshipInvite,
      attributes: [
        'created_at',
        'status',
        'type',
        'updated_at'
      ],
      getters: {
        questionAnswers: i => i.questionAnswers().fetch()
      },
      relations: ['createdBy', 'fromGroup', 'toGroup']
    },

    GroupRole: {
      model: GroupRole,
      attributes: [
        'emoji',
        'description',
        'group_id',
        'name',
        'active',
        'createdAt',
        'updatedAt'
      ],
      relations: [
        'group',
        { responsibilities: { querySet: true } }
      ],
      getters: {
        canAccess: gr => {
          if (!gr || !userId) return false
          // Check if user has the group_role scope
          const requiredScope = createGroupRoleScope(gr.get('id'))
          return UserScope.canAccess(userId, requiredScope)
        }
      }
    },

    CustomView: {
      model: CustomView,
      attributes: [
        'active_posts_only',
        'collection_id',
        'default_sort',
        'default_view_mode',
        'group_id',
        'icon',
        'is_active',
        'name',
        'order',
        'post_types',
        'type',
        'search_text'
      ],
      getters: {
        externalLink: customView => TextHelpers.sanitizeURL(customView.get('external_link'))
      },
      relations: [
        'collection',
        'group',
        { tags: { alias: 'topics' } }
      ]
    },

    Collection: {
      model: Collection,
      attributes: [
        'created_at',
        'name',
        'updated_at'
      ],
      relations: [
        'group',
        { linkedPosts: { querySet: true } },
        { posts: { querySet: true } },
        'user'
      ]
    },

    CollectionsPost: {
      model: CollectionsPost,
      attributes: [
        'created_at',
        'order',
        'updated_at'
      ],
      relations: [
        'post',
        'user'
      ]
    },

    Invitation: {
      model: Invitation,
      attributes: [
        'id',
        'created_at',
        'email',
        'last_sent_at',
        'token'
      ],
      relations: [
        'creator',
        'group'
      ]
    },

    JoinRequest: {
      model: JoinRequest,
      attributes: [
        'created_at',
        'updated_at',
        'status'
      ],
      relations: [
        'group',
        'user'
      ],
      getters: {
        questionAnswers: jr => jr.questionAnswers().fetch()
      },
      fetchMany: ({ groupId }) => JoinRequest.where({ group_id: groupId, status: JoinRequest.STATUS.Pending })
    },

    Question: {
      model: Question,
      attributes: [
        'text'
      ]
    },

    Affiliation: {
      model: Affiliation,
      attributes: [
        'created_at',
        'updated_at',
        'role',
        'preposition',
        'org_name',
        'url',
        'is_active'
      ],
      relations: ['user']
    },

    EventInvitation: {
      model: EventInvitation,
      attributes: [
        'response'
      ],
      relations: [
        { user: { alias: 'person' } }
      ]
    },

    Comment: {
      model: Comment,
      attributes: [
        'created_at',
        'edited_at'
      ],
      relations: [
        'post',
        { user: { alias: 'creator' } },
        { childComments: { querySet: true } },
        {
          media: {
            alias: 'attachments',
            arguments: ({ type }) => [type]
          }
        }
      ],
      getters: {
        text: comment => comment.text(userId),
        parentComment: (c) => c.parentComment().fetch(),
        myReactions: c => userId ? c.reactionsForUser(userId).fetch() : [],
        commentReactions: c => c.reactions().fetch() // XXX: for some reason this doesn't work as relationship alias, I dont know why
      },
      filter: nonAdminFilter(commentFilter(userId)),
      isDefaultTypeForTable: true
    },

    LinkPreview: {
      model: LinkPreview,
      attributes: [
        'description',
        'image_url',
        'status',
        'title',
        'url'
      ]
    },

    Location: {
      model: Location,
      attributes: [
        'accuracy',
        'address_number',
        'address_street',
        'bbox',
        'center',
        'city',
        'country',
        'full_text',
        'locality',
        'neighborhood',
        'region',
        'postcode'
      ]
    },

    MessageThread: {
      model: Post,
      attributes: ['created_at', 'updated_at'],
      getters: {
        unreadCount: t => t.unreadCountForUser(userId),
        lastReadAt: t => t.lastReadAtForUser(userId)
      },
      relations: [
        { followers: { alias: 'participants' } },
        { comments: { alias: 'messages', typename: 'Message', querySet: true } }
      ],
      filter: relation => relation.query(q =>
        q.whereIn('posts.id', PostUser.followedPostIds(userId)))
    },

    Message: {
      model: Comment,
      attributes: ['created_at'],
      relations: [
        { post: { alias: 'messageThread', typename: 'MessageThread' } },
        { user: { alias: 'creator' } }
      ],
      filter: messageFilter(userId)
    },

    Reaction: {
      model: Reaction,
      attributes: [
        'user_id'
      ],
      getters: {
        createdAt: r => r.get('date_reacted'),
        emojiBase: r => r.get('emoji_base'),
        emojiFull: r => r.get('emoji_full'),
        emojiLabel: r => r.get('emoji_label'),
        entityId: r => r.get('entity_id'),
        entityType: r => r.get('entity_type')
      },
      isDefaultTypeForTable: true,
      relations: [
        'post',
        'user'
      ],
      filter: nonAdminFilter(reactionFilter('reactions', userId))
    },

    GroupTopic: {
      model: GroupTag,
      attributes: ['created_at', 'is_default', 'updated_at', 'visibility'],
      getters: {
        postsTotal: gt => gt.postCount(),
        followersTotal: gt => gt.followerCount(),
        isSubscribed: gt => userId ? gt.isFollowed(userId) : null,
        lastReadPostId: gt => userId ? gt.lastReadPostId(userId) : null,
        newPostCount: gt => userId ? gt.newPostCount(userId) : null
      },
      relations: [
        'group',
        { tag: { alias: 'topic' } }
      ],
      filter: nonAdminFilter(relation => relation.query(q => {
        q.whereIn('groups_tags.group_id', Group.selectIdsForMember(userId))
      })),
      fetchMany: args => GroupTag.query(groupTopicFilter(userId, args))
    },

    Responsibility: {
      model: Responsibility,
      attributes: [
        'id',
        'title',
        'description',
        'type'
      ]
    },

    SavedSearch: {
      model: SavedSearch,
      attributes: [
        'boundingBox',
        'group',
        'context',
        'created_at',
        'name',
        'is_active',
        'search_text',
        'post_types'
      ],
      fetchMany: ({ userId }) => SavedSearch.where({ user_id: userId, is_active: true })
    },

    Skill: {
      model: Skill,
      attributes: ['name'],
      fetchMany: ({ autocomplete, first = 1000, offset = 0 }) =>
        searchQuerySet('skills', {
          autocomplete, first, offset, currentUserId: userId
        })
    },

    Topic: {
      model: Tag,
      attributes: ['name'],
      getters: {
        postsTotal: (t, opts = {}) =>
          Tag.taggedPostCount(t.id, Object.assign({}, opts, { userId })),
        followersTotal: (t, opts = {}) =>
          Tag.followersCount(t.id, Object.assign({}, opts, { userId }))
      },
      relations: [{
        groupTags: {
          alias: 'groupTopics',
          querySet: true,
          filter: (relation, { autocomplete, subscribed, isDefault, visibility, groupId, groupIds }) =>
            relation.query(groupTopicFilter(userId, {
              autocomplete,
              groupId,
              groupIds,
              isDefault,
              subscribed,
              visibility
            })
            )
        }
      }],
      fetchMany: ({ groupSlug, groupIds, name, isDefault, visibility, autocomplete, first, offset = 0, sortBy }) =>
        searchQuerySet('tags', { userId, groupSlug, groupIds, name, autocomplete, isDefault, visibility, limit: first, offset, sort: sortBy })
    },

    TopicFollow: {
      model: TagFollow,
      attributes: ['created_at', 'last_read_post_id', 'new_post_count', 'settings', 'updated_at'],
      relations: [
        'group',
        { tag: { alias: 'topic' } },
        'user'
      ],
      fetchMany: args => TagFollow.query()
    },

    Track: {
      model: Track,
      attributes: [
        'access_controlled',
        'action_descriptor',
        'action_descriptor_plural',
        'created_at',
        'banner_url',
        'completion_role_type',
        'completion_message',
        'deactivated_at',
        'description',
        'name',
        'num_actions',
        'num_people_completed',
        'num_people_enrolled',
        'published_at',
        'updated_at',
        'welcome_message'
      ],
      relations: [
        'completionRole',
        { enrolledUsers: { querySet: true } },
        { groups: { querySet: true } },
        { posts: { querySet: true } },
        { users: { querySet: true } }
      ],
      getters: {
        canAccess: t => t ? t.canAccess(userId) : false,
        isEnrolled: t => t && userId && t.isEnrolled(userId),
        didComplete: t => t && userId && t.didComplete(userId),
        userSettings: t => t && userId ? t.userSettings(userId) : null,

      },
      fetchMany: ({ autocomplete, first = 20, offset = 0, order, published, sortBy }) =>
        searchQuerySet('tracks', {
          autocomplete, first, offset, order, published, sortBy
        })
    },

    TrackUser: {
      model: TrackUser,
      attributes: [
        'completed_at',
        'created_at',
        'enrolled_at',
        'settings',
        'updated_at'
      ],
      relations: ['track', 'group', 'user']
    },

    FundingRound: {
      model: FundingRound,
      attributes: [
        'allow_self_voting',
        'banner_url',
        'created_at',
        'criteria',
        'description',
        'hide_final_results_from_participants',
        'max_token_allocation',
        'min_token_allocation',
        'num_participants',
        'num_submissions',
        'phase',
        'published_at',
        'require_budget',
        'submission_descriptor_plural',
        'submission_descriptor',
        'submissions_close_at',
        'submissions_open_at',
        'title',
        'token_type',
        'total_tokens',
        'updated_at',
        'voting_closes_at',
        'voting_method',
        'voting_opens_at'
      ],
      getters: {
        canSubmit: r => r && userId ? r.canUserSubmit(userId) : false,
        canVote: r => r && userId ? r.canUserVote(userId) : false,
        isParticipating: r => r && userId && r.isParticipating(userId),
        joinedAt: r => r && userId ? r.joinedAt(userId) : null,
        submitterRoles: r => r ? r.submitterRoles() : [],
        allocations: r => r ? r.allocations() : [],
        tokensRemaining: async r => {
          if (!r || !userId) return null
          return r.roundUser(userId).fetch().then(roundUser => roundUser ? roundUser.get('tokens_remaining') : null)
        },
        totalTokensAllocated: async r => {
          if (!r) return null
          const result = await bookshelf.knex('posts_users')
            .join('funding_rounds_posts', 'posts_users.post_id', 'funding_rounds_posts.post_id')
            .where('funding_rounds_posts.funding_round_id', r.get('id'))
            .sum('posts_users.tokens_allocated_to as total')
            .first()
          return result?.total ? parseInt(result.total) : 0
        },
        userSettings: r => r && userId ? r.userSettings(userId) : null,
        voterRoles: r => r ? r.voterRoles() : []
      },
      relations: [
        'group',
        { submissions: { querySet: true } },
        { users: { querySet: true } }
      ],
      fetchMany: ({ first, order, offset = 0, published, search }) =>
        searchQuerySet('funding_rounds', {
          first, order, offset, published, search
        })
    },

    Notification: {
      model: Notification,
      relations: ['activity'],
      getters: {
        createdAt: n => n.get('created_at')
      },
      fetchMany: ({ first, order, offset = 0 }) =>
        Notification.where({
          medium: Notification.MEDIUM.InApp,
          'notifications.user_id': userId
        })
          .orderBy('id', order)
      // TODO: fix this filter. Currently it filters out any notification without a comment
      // filter: (relation) => relation.query(q => {
      //   q.join('activities', 'activities.id', 'notifications.activity_id')
      //   q.join('posts', 'posts.id', 'activities.post_id')
      //   q.join('comments', 'comments.id', 'activities.comment_id')
      //   q.whereNotIn('activities.actor_id', BlockedUser.blockedFor(userId))
      //   q.whereNotIn('posts.user_id', BlockedUser.blockedFor(userId))
      //   q.whereNotIn('comments.user_id', BlockedUser.blockedFor(userId))
      // })
    },

    Activity: {
      model: Activity,
      attributes: ['meta', 'unread'],
      relations: [
        'actor',
        'post',
        'comment',
        'fundingRound',
        'group',
        'otherGroup',
        'track'
      ],
      getters: {
        action: a => Notification.priorityReason(a.get('meta').reasons)
      }
    },

    PersonConnection: {
      model: UserConnection,
      attributes: [
        'type',
        'created_at',
        'updated_at'
      ],
      relations: [{ otherUser: { alias: 'person' } }],
      fetchMany: () => UserConnection,
      filter: relation => {
        return relation.query(q => {
          if (userId) {
            q.whereNotIn('other_user_id', BlockedUser.blockedFor(userId))
            q.where('user_id', userId)
          }
          q.orderBy('created_at', 'desc')
        })
      }
    },

    Attachment: {
      model: Media,
      attributes: [
        'type',
        'url',
        'thumbnail_url',
        'position',
        'created_at'
      ]
    },

    PostMembership: {
      model: PostMembership,
      relations: [
        'group'
      ]
    },

    PostUser: {
      model: PostUser,
      attributes: [
        'completed_at',
        'completion_response'
      ],
      relations: [
        'post',
        'user'
      ]
    },

    ProposalOption: {
      model: ProposalOption,
      attributes: [
        'emoji',
        'color',
        'text'
      ]
    },

    ProposalVote: {
      model: ProposalVote,
      attributes: [
        'created_at',
        'id',
        'option_id'
      ],
      relations: [
        'user'
      ]
    },

    GroupExtension: {
      model: GroupExtension,
      attributes: [
        'id',
        'active',
        'type'
      ],
      getters: {
        data: groupExtension => groupExtension.pivot && groupExtension.pivot.get('data')
      }
    },

    Extension: {
      model: Extension,
      attributes: [
        'id',
        'type'
      ]
    },

    GroupWidget: {
      model: GroupWidget,
      attributes: [
        'id',
        'is_visible',
        'name',
        'order',
        'context'
      ],
      getters: {
        settings: gw => mapKeys(camelCase, gw.get('settings'))
      },
      relations: ['group']
    },

    Widget: {
      model: Widget,
      attributes: [
        'id',
        'name'
      ]
    },

    StripeOffering: {
      model: StripeProduct,
      attributes: [
        'id',
        'created_at',
        'updated_at',
        'group_id',
        'stripe_product_id',
        'stripe_price_id',
        'name',
        'description',
        'price_in_cents',
        'currency',
        'track_id',
        'access_grants',
        'renewal_policy',
        'duration',
        'publish_status'
      ],
      relations: [
        'group',
        'track'
      ],
      getters: {
        stripeProductId: sp => sp.get('stripe_product_id'),
        stripePriceId: sp => sp.get('stripe_price_id'),
        priceInCents: sp => sp.get('price_in_cents'),
        trackId: sp => sp.get('track_id'),
        accessGrants: sp => sp.get('access_grants'),
        renewalPolicy: sp => sp.get('renewal_policy'),
        publishStatus: sp => sp.get('publish_status'),
        tracks: async (sp) => {
          if (!sp) return []
          const accessGrants = sp.get('access_grants')
          if (!accessGrants) return []

          // Parse accessGrants (might be string or object)
          let grants = {}
          if (typeof accessGrants === 'string') {
            try {
              grants = JSON.parse(accessGrants)
            } catch {
              return []
            }
          } else {
            grants = accessGrants
          }

          // Extract all trackIds from all groups
          const trackIds = []
          if (grants.trackIds && Array.isArray(grants.trackIds)) {
            trackIds.push(...grants.trackIds.map(id => parseInt(id)))
          }

          if (trackIds.length === 0) return []

          // Fetch tracks
          const tracks = await Track.where('id', 'in', trackIds).fetchAll()
          return tracks.models || []
        },
        roles: async (sp) => {
          if (!sp) return []
          const accessGrants = sp.get('access_grants')
          if (!accessGrants) return []

          // Parse accessGrants (might be string or object)
          let grants = {}
          if (typeof accessGrants === 'string') {
            try {
              grants = JSON.parse(accessGrants)
            } catch {
              return []
            }
          } else {
            grants = accessGrants
          }

          const allRoles = []

          // Handle new format: separate commonRoleIds and groupRoleIds
          if (grants.commonRoleIds && Array.isArray(grants.commonRoleIds)) {
            const commonRoleIds = grants.commonRoleIds.map(id => parseInt(id)).filter(id => !isNaN(id))
            if (commonRoleIds.length > 0) {
              const commonRoles = await CommonRole.where('id', 'in', commonRoleIds).fetchAll()
              allRoles.push(...(commonRoles.models || []))
            }
          }

          if (grants.groupRoleIds && Array.isArray(grants.groupRoleIds)) {
            const groupRoleIds = grants.groupRoleIds.map(id => parseInt(id)).filter(id => !isNaN(id))
            if (groupRoleIds.length > 0) {
              const groupRoles = await GroupRole.where('id', 'in', groupRoleIds).fetchAll()
              allRoles.push(...(groupRoles.models || []))
            }
          }

          // Handle legacy format: roleIds (assume group roles for backwards compatibility)
          if (grants.roleIds && Array.isArray(grants.roleIds) && (!grants.commonRoleIds && !grants.groupRoleIds)) {
            const roleIds = grants.roleIds.map(id => parseInt(id)).filter(id => !isNaN(id))
            if (roleIds.length > 0) {
              const groupRoles = await GroupRole.where('id', 'in', roleIds).fetchAll()
              allRoles.push(...(groupRoles.models || []))
            }
          }

          return allRoles
        }
      }
    },

    ContentAccess: {
      model: ContentAccess,
      isDefaultTypeForTable: true,
      attributes: [
        'id',
        'created_at',
        'updated_at',
        'user_id',
        'granted_by_group_id',
        'group_id',
        'track_id',
        'group_role_id',
        'common_role_id',
        'access_type',
        'stripe_session_id',
        'stripe_subscription_id',
        'status',
        'granted_by_id',
        'expires_at',
        'metadata'
      ],
      relations: [
        'user',
        'grantedByGroup',
        'group',
        { product: { alias: 'offering', typename: 'StripeOffering' } },
        'track',
        'groupRole',
        'commonRole',
        'grantedBy'
      ],
      fetchMany: (args) => {
        // Store args for use in filter function
        ContentAccess._fetchManyArgs = args
        return ContentAccess
      },
      filter: (relation) => {
        const args = ContentAccess._fetchManyArgs || {}
        const { groupIds, search, accessType, status, offeringId, trackId, groupRoleId, commonRoleId, sortBy = 'created_at', order } = args

        return relation.query(q => {
          // Filter by group IDs (groups that granted the access)
          if (groupIds && groupIds.length > 0) {
            q.whereIn('content_access.granted_by_group_id', groupIds)
          }

          // Filter by user name search
          if (search) {
            q.join('users', 'users.id', '=', 'content_access.user_id')
            q.whereRaw('users.name ilike ?', `%${search}%`)
          }

          // Filter by access type
          if (accessType) {
            q.where('content_access.access_type', accessType)
          }

          // Filter by status
          if (status) {
            q.where('content_access.status', status)
          }

          // Filter by offering ID
          if (offeringId) {
            q.where('content_access.product_id', offeringId)
          }

          // Filter by track ID
          if (trackId) {
            q.where('content_access.track_id', trackId)
          }

          // Filter by group role ID
          if (groupRoleId) {
            q.where('content_access.group_role_id', groupRoleId)
          }

          // Filter by common role ID
          if (commonRoleId) {
            q.where('content_access.common_role_id', commonRoleId)
          }

          // Apply sorting
          const validSortColumns = {
            created_at: 'content_access.created_at',
            expires_at: 'content_access.expires_at',
            user_name: 'users.name'
          }

          const sortColumn = validSortColumns[sortBy] || validSortColumns.created_at

          // If sorting by user name and not already joined, join users table
          if (sortBy === 'user_name' && !search) {
            q.join('users', 'users.id', '=', 'content_access.user_id')
          }

          // Apply sorting
          if (sortBy === 'user_name') {
            q.orderByRaw(`lower("users"."name") ${order || 'asc'}`)
          } else {
            q.orderBy(sortColumn, order || 'desc')
          }
        })
      },
      getters: {
        userId: ca => ca.get('user_id'),
        grantedByGroupId: ca => ca.get('granted_by_group_id'),
        groupId: ca => ca.get('group_id'),
        offeringId: ca => ca.get('product_id'),
        trackId: ca => ca.get('track_id'),
        groupRoleId: ca => ca.get('group_role_id'),
        commonRoleId: ca => ca.get('common_role_id'),
        accessType: ca => ca.get('access_type'),
        stripeSessionId: ca => ca.get('stripe_session_id'),
        stripeSubscriptionId: ca => ca.get('stripe_subscription_id'),
        grantedById: ca => ca.get('granted_by_id'),
        subscriptionCancelAtPeriodEnd: ca => {
          const metadata = ca.get('metadata') || {}
          return metadata.subscription_cancel_at_period_end === true
        },
        subscriptionPeriodEnd: ca => {
          const metadata = ca.get('metadata') || {}
          return metadata.subscription_period_end ? new Date(metadata.subscription_period_end) : null
        },
        subscriptionCancellationScheduledAt: ca => {
          const metadata = ca.get('metadata') || {}
          return metadata.subscription_cancellation_scheduled_at ? new Date(metadata.subscription_cancellation_scheduled_at) : null
        },
        subscriptionCancelReason: ca => {
          const metadata = ca.get('metadata') || {}
          return metadata.subscription_cancel_reason || null
        }
      }
    }
  }
}
