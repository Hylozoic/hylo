/* global GroupToGroupJoinQuestion, Location, Slack, Widget, FundingRound */
/* eslint-disable camelcase */
import knexPostgis from 'knex-postgis'
import { GraphQLError } from 'graphql'
import { clone, defaults, difference, flatten, intersection, isEmpty, mapValues, merge, sortBy, pick, omit, omitBy, isUndefined, trim, xor } from 'lodash'
import { v4 as uuidv4 } from 'uuid'
import mbxGeocoder from '@mapbox/mapbox-sdk/services/geocoding'
import fetch from 'node-fetch'
import randomstring from 'randomstring'
import wkx from 'wkx'
import ical from 'ical-generator'
import { writeStringToS3 } from '../../lib/uploader/storage'

import mixpanel from '../../lib/mixpanel'
import { AnalyticsEvents, LocationHelpers, POST_TYPE_TO_TYPED_VIEW } from '@hylo/shared'
import HasSettings from './mixins/HasSettings'
import findOrCreateThread from './post/findOrCreateThread'
import { groupFilter } from '../graphql/filters'
import { inviteGroupToGroup } from '../graphql/mutations/group'
import { findOrCreateLocation } from '../graphql/mutations/location'
import { whereId } from './group/queryUtils'
import { getLocaleStrings } from '../../lib/i18n/locales'
import { groupRoom, userRoom, pushToSockets } from '../services/Websockets'
const { createGroupScope } = require('../../lib/scopes')

export const GROUP_MEMBERSHIP_ATTR_UPDATE_WHITELIST = [
  'project_role_id',
  'following',
  'settings',
  'active',
  'nav_order'
]

// For files in the public directory, reference them with the base URL
const DEFAULT_BANNER = '/default-group-banner.svg'
const DEFAULT_AVATAR = '/default-group-avatar.svg'

module.exports = bookshelf.Model.extend(merge({
  tableName: 'groups',
  requireFetch: false,
  hasTimestamps: true,

  parse (response) {
    // Convert geometry hex values into GeoJSON before returning to the client
    if (typeof response.geo_shape === 'string') {
      const b = Buffer.from(response.geo_shape, 'hex')
      const parsedGeo = wkx.Geometry.parse(b)
      response.geo_shape = parsedGeo.toGeoJSON()
    }

    return response
  },

  // Knex binds JS arrays as Postgres arrays ({chat}), which is invalid for jsonb.
  // Stringify jsonb array columns before save (same pattern as FundingRound).
  format (attrs) {
    const formatted = Object.assign({}, attrs)
    if (Array.isArray(formatted.accepted_post_types)) {
      formatted.accepted_post_types = JSON.stringify(formatted.accepted_post_types)
    }
    if (Array.isArray(formatted.required_roles)) {
      formatted.required_roles = JSON.stringify(formatted.required_roles)
    }
    return formatted
  },

  /**
   * Builds a Stripe Dashboard URL for this group's connected account
   */
  async stripeDashboardUrl () {
    try {
      const stripeAccountId = this.get('stripe_account_id')
      if (!stripeAccountId) return null
      const acct = await StripeAccount.where({ id: stripeAccountId }).fetch()
      if (!acct) return null
      const externalId = acct.get('stripe_account_external_id')
      if (!externalId) return null
      return `https://dashboard.stripe.com/${externalId}`
    } catch (e) {
      return null
    }
  },

  /**
   * Check if a user has access to this group
   * If group has no paywall, returns true (free access)
   * Otherwise checks: 1) full-access responsibilities, 2) scope-based access
   * @param {String|Number} userId - User ID to check
   * @returns {Promise<Boolean>}
   */
  async canAccess (userId) {
    // If no paywall, group is freely accessible
    if (!this.get('paywall')) {
      return true
    }

    if (!userId) {
      return false
    }

    // Check if user has full-access responsibility (admin or content manager)
    const groupId = this.get('id')
    const hasFullAccess = await Group.hasFullAccessResponsibility(userId, groupId)
    if (hasFullAccess) {
      return true
    }

    // Check scope-based access (purchased or granted)
    const requiredScope = createGroupScope(groupId)
    return await UserScope.canAccess(userId, requiredScope)
  },

  // ******** Getters ******* //

  /**
   * Active agreements for this group. Spaces inherit the parent group's agreements.
   */
  agreements: function () {
    const parentId = this.get('parent_id')
    if (parentId) {
      return Group.forge({ id: parentId }).agreements()
    }
    return this.belongsToMany(Agreement).through(GroupAgreement)
      .where('groups_agreements.active', true)
      .withPivot(['order']).query(q => {
        q.orderByRaw('_pivot_order asc')
      })
  },

  // The full tree of child groups + grandchild groups, etc. includes the root group too.
  // Parent-child only — peer relationships share this table and must not appear in streams.
  allChildGroups () {
    const parentChild = Group.RelationshipType.PARENT_CHILD
    return Group.collection().query(q => {
      q.where('groups.active', true)

      // Learned from https://persagen.com/2018/06/06/postgresql_trees_recursive_cte.html
      q.whereRaw(`groups.id in (
        WITH RECURSIVE group_nodes(id, child, all_child_ids) AS (
            SELECT id, child_group_id, ARRAY[child_group_id]
            FROM group_relationships
            WHERE parent_group_id = ? AND active = true AND relationship_type = ?
        UNION ALL
            SELECT child_nodes.id, child_nodes.child_group_id, all_child_ids||child_nodes.child_group_id
            FROM group_relationships child_nodes
            JOIN group_nodes n
              ON n.child = child_nodes.parent_group_id
              AND child_nodes.active = true
              AND child_nodes.relationship_type = ?
              AND child_nodes.child_group_id <> ALL (all_child_ids)
        )
        select distinct unnest(all_child_ids) as child_id from group_nodes order by child_id
      )`, [this.id, parentChild, parentChild])
    })
  },

  childGroups () {
    return this.belongsToMany(Group)
      .through(GroupRelationship, 'parent_group_id', 'child_group_id')
      .query({
        where: {
          'group_relationships.active': true,
          'group_relationships.relationship_type': 0, // PARENT_CHILD
          'groups.active': true
        }
      })
      .query(q => Group.excludeSpaces(q))
      .orderBy('groups.name', 'asc')
  },

  // Spaces & Views: all child spaces of this group/space, via groups.parent_id
  // (includes archived spaces — filter on active where needed) (spec section 3.4)
  spaces () {
    return this.hasMany(Group, 'parent_id').query(q => q.where('type', 'space'))
  },

  comments: function () {
    return Comment.collection().query(q => {
      q.join('groups_posts', 'groups_posts.post_id', 'comments.post_id')
      q.where({
        'groups_posts.group_id': this.id,
        'comments.active': true
      })
    })
  },

  creator: function () {
    return this.belongsTo(User, 'created_by_id')
  },

  fundingRounds () {
    return this.hasMany(FundingRound, 'group_id')
  },

  // Spaces & Views: the FundingRound whose space this group is (spec section 3.4)
  fundingRound () {
    return this.belongsTo(FundingRound, 'funding_round_id')
  },

  groupAgreements () {
    return this.hasMany(GroupAgreement)
  },

  groupRelationshipInvitesFrom () {
    return this.hasMany(GroupRelationshipInvite, 'from_group_id')
      .query({ where: { status: GroupRelationshipInvite.STATUS.Pending } })
  },

  groupRelationshipInvitesTo () {
    return this.hasMany(GroupRelationshipInvite, 'to_group_id')
      .query({ where: { status: GroupRelationshipInvite.STATUS.Pending } })
  },

  /**
   * Role definitions for this group. Spaces inherit from the parent group
   * (no per-space groups_roles rows).
   */
  groupRoles () {
    const localKey = this.get('parent_id') ? 'parent_id' : 'id'
    return this.hasMany(GroupRole, 'group_id', localKey)
  },

  groupTags () {
    return this.hasMany(GroupTag)
  },

  groupExtensions: function () {
    return this.belongsToMany(Extension).through(GroupExtension).where('group_extensions.active', true)
      .withPivot(['data'])
  },

  // Spaces & Views: ordered list of this group's/space's own views (spec section 3.4)
  groupViews () {
    return this.hasMany(GroupView, 'group_id').query(q => q.orderBy('order', 'asc'))
  },

  groupToGroupJoinQuestions () {
    return this.hasMany(GroupToGroupJoinQuestion).query(q => {
      q.select(['questions.text', 'questions.id as questionId'])
      q.join('questions', 'group_to_group_join_questions.question_id', 'questions.id')
    })
  },

  hasMurmurationsProfile () {
    return this.get('visibility') === Group.Visibility.PUBLIC && this.getSetting('publish_murmurations_profile')
  },

  murmurationsProfileUrl () {
    return process.env.PROTOCOL + '://' + process.env.DOMAIN + '/noo/group/' + this.get('slug') + '/murmurations'
  },

  isHidden () {
    return this.get('visibility') === Group.Visibility.HIDDEN
  },

  joinQuestions () {
    return this.hasMany(GroupJoinQuestion).query(q => {
      q.select(['questions.text', 'questions.id as questionId'])
      q.join('questions', 'group_join_questions.question_id', 'questions.id')
    })
  },

  locationObject () {
    return this.belongsTo(Location, 'location_id')
  },

  /**
   * System + group-custom responsibilities available for role editing.
   * Spaces resolve against the parent group.
   */
  availableResponsibilities () {
    const groupId = this.get('parent_id') || this.id
    return Responsibility.collection().query(q => {
      q.whereRaw('group_id = ? or group_id is null', groupId)
    })
  },

  members (where) {
    // TODO RESP: does this need to change or should we just build a new one for it... the problem is the access to the role attribute.
    // It doesn't seem like there are any more Node calls of this that rely on the role being present
    // But I suspect that there might be graphQL queries that rely on it
    return this.belongsToMany(User).through(GroupMembership)
      .query(q => {
        q.where({
          'group_memberships.active': true,
          'users.active': true
        })
        if (where) {
          q.where(where)
        }
      })
      .withPivot(['created_at', 'settings'])
  },

  memberships (includeInactive = false) {
    // TODO: need to check if person is active too?
    return this.hasMany(GroupMembership)
      .query(q => includeInactive ? q : q.where('group_memberships.active', true))
  },

  memberCount: function () {
    return this.get('num_members')
  },

  /** Cached count of pending (unprocessed) join requests. */
  openJoinRequestCount: function () {
    return this.get('num_open_join_requests') || 0
  },

  // This returns all members with the given responsibilities (ids or title strings)
  /**
   * Members of this group/space who hold any of the given responsibilities.
   * Role assignments are resolved against the parent for spaces.
   */
  membersWithResponsibilities (responsibilities) {
    const useTitles = responsibilities.some(r => typeof r === 'string' && Number.isNaN(Number(r)))
    return this.members().query(q => {
      const placeholders = responsibilities.map(() => '?').join(',')
      // Spaces inherit roles from parent: match assignments on COALESCE(parent_id, id)
      const roleScopeJoin = `group_memberships_group_roles.group_id = (
          select coalesce(g.parent_id, g.id) from groups g where g.id = group_memberships.group_id
        )`
      if (useTitles) {
        q.whereRaw(`exists (
          select * from group_memberships_group_roles
          inner join group_roles_responsibilities on group_roles_responsibilities.group_role_id = group_memberships_group_roles.group_role_id
          inner join responsibilities on responsibilities.id = group_roles_responsibilities.responsibility_id
          where responsibilities.title IN (${placeholders})
            and group_memberships_group_roles.user_id = users.id
            and ${roleScopeJoin}
        )`, responsibilities)
      } else {
        q.whereRaw(`exists (
          select * from group_memberships_group_roles
          inner join group_roles_responsibilities on group_roles_responsibilities.group_role_id = group_memberships_group_roles.group_role_id
          where group_roles_responsibilities.responsibility_id IN (${placeholders})
            and group_memberships_group_roles.user_id = users.id
            and ${roleScopeJoin}
        )`, responsibilities)
      }
    })
  },

  // This returns all members with the manage_content responsibility
  moderators () {
    return this.membersWithResponsibilities([3])
  },

  // This returns all members with the administration, manage_content and manage_members responsibilities
  stewards () {
    return this.membersWithResponsibilities([1, 3, 4])
  },

  // Return # of prereq groups userId is not a member of yet
  // This is used on front-end to figure out if user can see all prereqs or not
  async numPrerequisitesLeft (userId) {
    const prerequisiteGroups = await this.prerequisiteGroups().fetch()
    let num = prerequisiteGroups.models.length
    await Promise.map(prerequisiteGroups.models, async (prereq) => {
      const isMemberOfPrereq = await GroupMembership.forPair(userId, prereq.id).fetch()
      if (isMemberOfPrereq) {
        num = num - 1
      }
    })
    return num
  },

  parentGroups () {
    return this.belongsToMany(Group)
      .through(GroupRelationship, 'child_group_id', 'parent_group_id')
      .query({
        where: {
          'group_relationships.active': true,
          'group_relationships.relationship_type': 0, // PARENT_CHILD
          'groups.active': true
        }
      })
      .query(q => Group.excludeSpaces(q))
      .withPivot(['settings'])
      .orderBy('groups.name', 'asc')
  },

  parentGroupRelationships () {
    return this.hasMany(GroupRelationship, 'child_group_id')
      .query({ where: { active: true, relationship_type: 0 } }) // PARENT_CHILD only
  },

  // Spaces & Views: the top-level group (or parent space) this space belongs
  // to, via groups.parent_id — distinct from the group_relationships-based
  // parentGroups() used for peer/affiliation relationships (spec section 3.4)
  parentGroup () {
    return this.belongsTo(Group, 'parent_id')
  },

  peerGroups () {
    // For peer relationships, we need to get groups connected to this one in either direction
    // Since peer relationships are bidirectional, we can't use the normal belongsToMany().through() pattern
    // Instead, we create a collection query that gets the related groups
    const groupId = this.id
    return Group.collection().query(qb => {
      qb.distinct('groups.*')
        .join('group_relationships', function () {
          this.on(function () {
            this.on('groups.id', '=', 'group_relationships.parent_group_id')
              .andOn('group_relationships.child_group_id', '=', bookshelf.knex.raw('?', [groupId]))
          }).orOn(function () {
            this.on('groups.id', '=', 'group_relationships.child_group_id')
              .andOn('group_relationships.parent_group_id', '=', bookshelf.knex.raw('?', [groupId]))
          })
        })
        .where('group_relationships.active', true)
        .where('group_relationships.relationship_type', Group.RelationshipType.PEER_TO_PEER)
        .where('groups.active', true)
        .where('groups.id', '!=', groupId)
      Group.excludeSpaces(qb)
      qb.orderBy('groups.name', 'asc')
    })
  },

  peerGroupRelationships () {
    const groupId = this.id
    const collection = GroupRelationship.collection().query(qb => {
      qb.where('group_relationships.active', true)
        .where('group_relationships.relationship_type', Group.RelationshipType.PEER_TO_PEER)
        .where(function () {
          this.where('parent_group_id', groupId)
            .orWhere('child_group_id', groupId)
        })
    })

    // Add tableName method for GraphQL bridge compatibility
    collection.tableName = () => 'group_relationships'
    return collection
  },

  // Get peer groups visible to a specific user (respects visibility rules)
  visiblePeerGroups (userId) {
    if (!userId) {
      // Non-authenticated users can only see public peer groups
      return this.peerGroups().query(qb => {
        qb.where('groups.visibility', Group.Visibility.PUBLIC)
      })
    }

    const groupId = this.id
    return Group.query(qb => {
      qb.join('group_relationships', function () {
        this.on(function () {
          this.on('groups.id', '=', 'group_relationships.parent_group_id')
            .andOn('group_relationships.child_group_id', '=', groupId)
        }).orOn(function () {
          this.on('groups.id', '=', 'group_relationships.child_group_id')
            .andOn('group_relationships.parent_group_id', '=', groupId)
        })
      })
        .where('group_relationships.active', true)
        .where('group_relationships.relationship_type', Group.RelationshipType.PEER_TO_PEER)
        .where('groups.active', true)
        .where('groups.id', '!=', groupId)
        .where(qb2 => {
          // Can see public peer groups
          qb2.where('groups.visibility', Group.Visibility.PUBLIC)
          // Can see protected peer groups if user is member of this group
          const selectIdsForMember = Group.selectIdsForMember(userId)
          qb2.orWhere(qb3 => {
            qb3.where('groups.visibility', Group.Visibility.PROTECTED)
            qb3.andWhere(groupId, 'in', selectIdsForMember)
          })
          // Stewards of this group can see hidden peer groups
          const selectStewardedGroupIds = Group.selectIdsByResponsibilities(userId, [Responsibility.constants.RESP_ADMINISTRATION])
          qb2.orWhere(qb4 => {
            qb4.where('groups.visibility', Group.Visibility.HIDDEN)
            qb4.andWhere(groupId, 'in', selectStewardedGroupIds)
          })
        })
      Group.excludeSpaces(qb)
      qb.orderBy('groups.name', 'asc')
    })
  },

  prerequisiteGroups () {
    return this.parentGroups().query({ whereRaw: "(group_relationships.settings->>'isPrerequisite')::boolean = true" })
  },

  posts (userId) {
    return this.belongsToMany(Post).through(PostMembership)
      .query({ where: { 'posts.active': true } })
  },

  postCount: function (includeChat) {
    return Group.postCount(this.id, includeChat)
  },

  skills: function () {
    return Skill.collection().query(q => {
      q.join('skills_users', 'skills_users.skill_id', 'skills.id')
      q.join('group_memberships', 'group_memberships.user_id', 'skills_users.user_id')
      q.where({
        'group_memberships.group_id': this.id,
        'group_memberships.active': true
      })
    })
  },

  suggestedSkills: function () {
    return this.belongsToMany(Skill, 'groups_suggested_skills')
  },

  tags () {
    return this.belongsToMany(Tag).through(GroupTag).withPivot(['is_default'])
  },

  /**
   * Tracks whose space is this group (tracks.group_id). Parent groups also list
   * child-space tracks via the GraphQL filter (see makeModels Group.tracks).
   */
  tracks () {
    return this.hasMany(Track, 'group_id')
  },

  // Spaces & Views: the Track whose space this group is (spec section 3.4)
  track () {
    return this.belongsTo(Track, 'track_id')
  },

  // The track-actions GroupView for this Track space (ordering via collections_posts)
  trackActionsView () {
    return this.hasOne(GroupView, 'group_id').query(q => q.where('type', GroupView.Type.TRACK_ACTIONS))
  },

  /**
   * Ordered active action Posts from this Track space's track-actions view.
   * @param {{ transacting?: object }} [opts]
   * @returns {Promise<Array>}
   */
  actionPosts: async function ({ transacting } = {}) {
    const view = await this.trackActionsView().fetch({ transacting })
    if (!view) return []
    const rows = await view.collectionPosts().fetch({ transacting })
    const postIds = rows.map(r => r.get('post_id'))
    if (postIds.length === 0) return []
    const posts = await Post.query(q => {
      q.whereIn('posts.id', postIds)
      q.where('posts.active', true)
      q.where('posts.type', Post.Type.ACTION)
    }).fetchAll({ transacting })
    const byId = new Map(posts.map(p => [String(p.id), p]))
    return postIds.map(id => byId.get(String(id))).filter(Boolean)
  },

  // The posts to show for a particular user viewing a group's stream or map
  // includes direct posts to this group + posts to child groups (group_relationships)
  // and child spaces (groups.parent_id) the user is an active member of
  viewPosts (userId) {
    const treeOfGroupsForMember = this.allChildGroups().query(q => {
      q.select('groups.id')
      q.join('group_memberships', 'group_memberships.group_id', 'groups.id')
      q.where({
        'group_memberships.user_id': userId,
        'group_memberships.active': true
      })
    })

    // Spaces link via parent_id, not group_relationships (see spaces() / spec §3.4)
    const childSpacesForMember = Group.collection().query(q => {
      q.select('groups.id')
      q.join('group_memberships', 'group_memberships.group_id', 'groups.id')
      q.where({
        'groups.parent_id': this.id,
        'groups.type': 'space',
        'groups.active': true,
        'group_memberships.user_id': userId,
        'group_memberships.active': true
      })
    })

    return Post.collection().query(q => {
      q.join('users', 'posts.user_id', 'users.id')
      q.where('users.active', true)
      q.andWhere(q2 => {
        q2.where('groups_posts.group_id', this.id)
        q2.orWhere(q3 => {
          q3.where(q4 => {
            q4.whereIn('groups_posts.group_id', treeOfGroupsForMember.query())
            q4.orWhereIn('groups_posts.group_id', childSpacesForMember.query())
          })
          q3.andWhere(q5 => {
            q5.where('posts.user_id', '!=', User.AXOLOTL_ID)
              .orWhereIn('posts.type', Post.NOTICE_TYPES)
          })
        })
      })
    })
  },

  widgets: function () {
    return this.hasMany(GroupWidget).query(q => {
      q.select(['widgets.name'])
      q.join('widgets', 'widgets.id', 'group_widgets.widget_id')
    })
  },

  // ******** Setters ********** //

  async addChild (childGroup, { transacting } = {}) {
    const childGroupId = childGroup instanceof Group ? childGroup.id : childGroup
    const existingChild = await GroupRelationship.where({ child_group_id: childGroupId, parent_group_id: this.id }).fetch({ transacting })
    if (existingChild) {
      return existingChild.save({ active: true }, { transacting })
    }
    return GroupRelationship.forge({ child_group_id: childGroupId, parent_group_id: this.id }).save({}, { transacting })
  },

  async addParent (parentGroup, { transacting } = {}) {
    const parentGroupId = parentGroup instanceof Group ? parentGroup.id : parentGroup
    const existingParent = await GroupRelationship.where({ parent_group_id: parentGroupId, child_group_id: this.id }).fetch({ transacting })
    if (existingParent) {
      return existingParent.save({ active: true }, { transacting })
    }
    return GroupRelationship.forge({ parent_group_id: parentGroup.id, child_group_id: this.id }).save({}, { transacting })
  },

  // if a group membership doesn't exist for a user id, create it.
  // make sure the group memberships have the passed-in role and settings
  // (merge on top of existing settings).
  async addMembers (usersOrIds, attrs = {}, { transacting } = {}) {
    const groupSettings = this.get('settings') || {}
    const defaultDigestFrequency = groupSettings.default_digest_frequency === 'weekly' ? 'weekly' : 'daily'
    const { assignCoordinator, ...membershipAttrs } = attrs

    const updatedAttribs = Object.assign(
      {},
      {
        active: true,
        settings: {
          postNotifications: 'all',
          digestFrequency: defaultDigestFrequency,
          sendEmail: true,
          sendPushNotifications: true,
          lastReadAt: membershipAttrs.lastReadAt || null
        }
      },
      pick(omitBy(membershipAttrs, isUndefined), GROUP_MEMBERSHIP_ATTR_UPDATE_WHITELIST)
    )

    const userIds = usersOrIds.map(x => x instanceof User ? x.id : x)
    const existingMemberships = await this.memberships(true)
      .query(q => q.whereIn('user_id', userIds)).fetch({ transacting })
    const reactivatedUserIds = existingMemberships.filter(m => !m.get('active')).map(m => m.get('user_id'))
    const existingUserIds = existingMemberships.pluck('user_id')
    const newUserIds = difference(userIds, existingUserIds)
    const updatedMemberships = await this.updateMembers(existingUserIds, updatedAttribs, { transacting })

    const newMemberships = []
    const defaultTagIds = (await GroupTag.defaults(this.id, transacting)).models.map(t => t.get('tag_id'))

    for (const id of newUserIds) {
      const membership = await this.memberships().create(
        Object.assign({}, updatedAttribs, {
          user_id: id,
          created_at: new Date(),
          settings: {
            // Show join form, and ask for agreements and join questions to be answered, unless member is the creator of the group
            agreementsAcceptedAt: id === this.get('created_by_id') ? new Date() : null,
            joinQuestionsAnsweredAt: id === this.get('created_by_id') ? new Date() : null,
            showJoinForm: id !== this.get('created_by_id'),
            ...updatedAttribs.settings
          }
        }), { transacting })
      newMemberships.push(membership)

      // Subscribe each user to the default tags in the group
      await User.followTags(id, this.id, defaultTagIds, transacting)
    }

    if (assignCoordinator) {
      for (const id of userIds) {
        await GroupMembership.assignCoordinatorRole(id, this.id, { transacting })
      }
    }

    // Increment num_members
    // XXX: num_members is updated every 10 minutes via cron, we are doing this here too for the case that someone joins a group and moderator looks immediately at member count after that
    // Coalesce: groups created without the column set (early spaces) carried NULL,
    // and NULL + n is NULL — the count could never self-heal through joins
    if (newUserIds.length > 0 || reactivatedUserIds.length > 0) {
      await this.save({ num_members: (this.get('num_members') || 0) + newUserIds.length + reactivatedUserIds.length }, { transacting })
    }

    Queue.classMethod('Group', 'afterAddMembers', {
      groupId: this.id,
      newUserIds,
      reactivatedUserIds
    })

    return updatedMemberships.concat(newMemberships)
  },

  createInitialWidgets: async function (transacting) {
    // In the future this will have to look up the template of whatever group is being created and add widgets based on that
    const initialWidgets = await Widget.query(q => q.whereIn('id', [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 19, 20, 21])).fetchAll({ transacting })
    Promise.map(initialWidgets.models, async (widget) => {
      await GroupWidget.create({ group_id: this.id, widget_id: widget.id, order: widget.id, context: widget.id > 10 ? 'group_profile' : 'landing' }, { transacting })
    })
  },

  // TODO: remove this, we are not using it right now
  createStarterPosts: function (transacting) {
    const now = new Date()
    const timeShift = { offer: 1, request: 2, resource: 3 }

    return Group.find('starter-posts', { withRelated: ['posts'] })
      .then(g => {
        if (!g) throw new Error('Starter posts group not found')
        return g
      })
      .then(g => g.relations.posts.models)
      .then(posts => Promise.map(posts, post => {
        if (post.get('type') === 'welcome') return
        const newPost = post.copy()
        const time = new Date(now - (timeShift[post.get('type')] || 0) * 1000)
        // TODO: why are we attaching Ed West as a follower to every welcome post??
        return newPost.save({ created_at: time, updated_at: time }, { transacting })
          .then(() => Promise.all(flatten([
            this.posts().attach(newPost, { transacting }),
            post.followers().fetch().then(followers =>
              newPost.addFollowers(followers.map(f => f.id), {}, { transacting })
            )
          ])))
      }))
  },

  async removeMembers (usersOrIds, { transacting } = {}) {
    const userIds = usersOrIds.map(x => x instanceof User ? x.id : x)
    const roleScopeId = await Group.roleScopeId(this)

    // Runs first, while the memberships it settles are still active
    await this.settleParticipation(userIds, { transacting })

    await this.updateMembers(usersOrIds, { active: false, nav_order: null }, { transacting })

    // Per-view unread rows would otherwise survive as frozen badge signals: unread
    // increments skip inactive members, but the parent group's badge check matches
    // group_views_users on user_id alone, so a leftover count can never be cleared.
    const viewUsersQuery = bookshelf.knex('group_views_users')
      .whereIn('user_id', userIds)
      .whereIn('view_id', bookshelf.knex('group_views').where('group_id', this.id).select('id'))
      .del()
    if (transacting) viewUsersQuery.transacting(transacting)
    await viewUsersQuery

    // Role assignments live on the role-scope group (parent for spaces). Only revoke when
    // leaving that group — not when leaving a child space while still in the parent.
    if (String(roleScopeId) === String(this.id)) {
      await Promise.map(userIds, userId =>
        GroupMembership.revokeAllGroupRoles(userId, roleScopeId, { transacting })
      )
      const agreementsQuery = bookshelf.knex('users_groups_agreements')
        .whereIn('user_id', userIds)
        .where('group_id', this.id)
        .update({ accepted: false })
      if (transacting) agreementsQuery.transacting(transacting)
      await agreementsQuery
    }

    // When removed from a parent group, also deactivate memberships in child spaces.
    if (this.get('type') !== 'space') {
      const spaces = await this.spaces().fetch({ transacting })
      await Promise.map(spaces.models, async (space) => {
        const spaceMemberships = await GroupMembership.forIds(userIds, space.id, { multiple: true }).fetch({ transacting })
        const activeSpaceUserIds = spaceMemberships.pluck('user_id')
        if (activeSpaceUserIds.length === 0) return
        await space.removeMembers(activeSpaceUserIds, { transacting })
      })
    }

    return this.save({ num_members: Math.max(0, (this.get('num_members') || 0) - usersOrIds.length) }, { transacting })
  },

  /**
   * Settle track enrollment / funding round participation for members leaving this space.
   * Lives here rather than in Track.leave / FundingRound.leave so every departure path is
   * covered — direct leave, moderator removal, and the parent-group cascade in removeMembers.
   * Must be called before memberships are deactivated: only currently active members count.
   * For funding rounds, also zeroes any tokens the leavers allocated to submissions so a
   * later rejoin cannot keep those votes.
   */
  async settleParticipation (userIds, { transacting } = {}) {
    const participation = [
      this.get('track_id') && { table: 'tracks', column: 'num_people_enrolled', id: this.get('track_id'), setting: 'completedAt' },
      this.get('funding_round_id') && { table: 'funding_rounds', column: 'num_participants', id: this.get('funding_round_id'), setting: 'tokensRemaining' }
    ].filter(Boolean)
    if (participation.length === 0) return

    const memberships = await GroupMembership.forIds(userIds, this.id, { multiple: true }).fetch({ transacting })
    if (memberships.length === 0) return

    const fundingRoundId = this.get('funding_round_id')
    if (fundingRoundId) {
      const submissionIdsQuery = bookshelf.knex('groups_posts')
        .join('posts', 'posts.id', 'groups_posts.post_id')
        .where('groups_posts.group_id', this.id)
        .where('posts.type', Post.Type.SUBMISSION)
        .pluck('posts.id')
      if (transacting) submissionIdsQuery.transacting(transacting)
      const submissionIds = await submissionIdsQuery
      if (submissionIds.length > 0) {
        const votesQuery = bookshelf.knex('posts_users')
          .whereIn('post_id', submissionIds)
          .whereIn('user_id', userIds)
          .update({ tokens_allocated_to: 0 })
        if (transacting) votesQuery.transacting(transacting)
        await votesQuery
      }
    }

    await Promise.map(memberships.models, async membership => {
      participation.forEach(({ setting }) => membership.removeSetting(setting))
      await membership.save({ settings: membership.get('settings') }, { patch: true, transacting })
    })

    await Promise.map(participation, async ({ table, column, id }) => {
      const query = bookshelf.knex(table)
        .where('id', id)
        .update({ [column]: bookshelf.knex.raw('greatest(0, coalesce(??, 0) - ?)', [column, memberships.length]) })
      if (transacting) query.transacting(transacting)
      await query
    })
  },

  async toMurmurationsObject () {
    const parentGroups = await this.parentGroups().fetch()
    const childrenGroups = await this.childGroups().fetch()
    const publicParents = parentGroups.filter(g => g.hasMurmurationsProfile()).map(g => ({ object_url: g.get('website_url') || Frontend.Route.group(g), predicate_url: 'https://schema.org/memberOf' }))
    const publicChildren = childrenGroups.filter(g => g.hasMurmurationsProfile()).map(g => ({ object_url: g.get('website_url') || Frontend.Route.group(g), predicate_url: 'https://schema.org/member' }))
    const profile = {
      linked_schemas: [
        'organizations_schema-v1.0.0'
      ],
      unique_id: 'hylo-group-' + this.id,
      name: this.get('name'),
      primary_url: this.get('website_url') || Frontend.Route.group(this),
      mission: this.get('purpose') || '',
      description: this.get('description') || '',
      image: this.get('avatar_url') || '',
      full_address: this.get('location') || '',
      relationships: publicParents.concat(publicChildren)
    }
    if (this.get('banner_url')) {
      profile.header_image = this.get('banner_url')
    }
    if (this.get('location_id')) {
      const location = this.get('location_id') ? await this.locationObject().fetch() : null
      profile.country_iso_3166 = location?.get('country_code') ? location?.get('country_code').toUpperCase() : ''
      profile.geolocation = {
        lat: location?.get('center').lat,
        lon: location?.get('center').lng
      }
    }
    return profile
  },

  async updateMembers (usersOrIds, attrs, { transacting } = {}) {
    const userIds = usersOrIds.map(x => x instanceof User ? x.id : x)

    const existingMemberships = await this.memberships(true)
      .query(q => q.whereIn('user_id', userIds)).fetch({ transacting })

    const pickedAttrs = pick(omitBy(attrs, isUndefined), GROUP_MEMBERSHIP_ATTR_UPDATE_WHITELIST)
    const joinFlowReset = { joinQuestionsAnsweredAt: null, showJoinForm: true }
    if (pickedAttrs.active === false || pickedAttrs.active === true) {
      joinFlowReset.agreementsAcceptedAt = null
      // Treat leave/rejoin as a first visit so welcome ("show to new members") shows again
      joinFlowReset.lastReadAt = null
    }
    const updatedAttribs = Object.assign(
      {},
      pickedAttrs,
      {
        settings: merge(
          {},
          pickedAttrs.settings || {},
          joinFlowReset
        )
      } // updateAndSave will merge these with existing settings
    )

    return Promise.map(existingMemberships.models, ms => ms.updateAndSave(updatedAttribs, { transacting }))
  },

  update: async function (changes, updatedByUserId) {
    const whitelist = [
      'about_video_uri', 'accepted_post_types', 'active', 'access_code', 'accessibility', 'avatar_url', 'banner_url',
      'description', 'geo_shape', 'icon', 'location', 'location_id', 'name', 'purpose', 'settings',
      'steward_descriptor', 'steward_descriptor_plural', 'type_descriptor', 'type_descriptor_plural', 'visibility',
      'website_url', 'stripe_account_id', 'stripe_charges_enabled', 'stripe_payouts_enabled', 'stripe_details_submitted', 'paywall'
    ]
    const trimAttrs = ['name', 'description', 'purpose']

    const attributes = mapValues(pick(changes, whitelist), (v, k) => trimAttrs.includes(k) ? trim(v) : v)
    const saneAttrs = clone(attributes)

    if (attributes.settings) {
      saneAttrs.settings = merge({}, this.get('settings'), attributes.settings)
    }

    // If location_id is explicitly set to something empty then set it to null
    // Otherwise leave it alone
    saneAttrs.location_id = Object.prototype.hasOwnProperty.call(saneAttrs, 'location_id') && isEmpty(saneAttrs.location_id) ? null : saneAttrs.location_id

    // Make sure geometry column goes into the database correctly, converting from GeoJSON
    if (!isEmpty(attributes.geo_shape)) {
      const st = knexPostgis(bookshelf.knex)
      saneAttrs.geo_shape = st.geomFromGeoJSON(attributes.geo_shape)
    } else if (Object.prototype.hasOwnProperty.call(saneAttrs, 'geo_shape')) {
      // if geo_shape is explicitly set to an empty value then unset it
      saneAttrs.geo_shape = null
    }

    this.set(saneAttrs)
    await this.validate()
    await bookshelf.transaction(async transacting => {
      if (changes.agreements && this.get('type') !== 'space' && !this.get('parent_id')) {
        const currentAgreementIds = (await this.agreements().fetch({ transacting })).pluck('id')
        const newAgreementIds = []

        // TODO: what if there are multiple agreements with the same title/description?
        const agreements = await Promise.map(changes.agreements.filter(a => trim(a.title) !== ''), async (a) => {
          let agreement = await Agreement.where({ title: trim(a.title), description: trim(a.description) }).fetch({ transacting })
          if (!agreement) {
            agreement = await Agreement.forge({ title: trim(a.title), description: trim(a.description) }).save({}, { transacting })
          }
          newAgreementIds.push(agreement.id)
          return agreement
        })

        // If there are any new/different agreements track the date of the change so we can tell group members
        // TODO: more sophisticated way to track what exactly changed in the text
        const differentIds = xor(currentAgreementIds, newAgreementIds)
        if (differentIds.length > 0) {
          this.addSetting({ agreements_last_updated_at: (new Date()).toISOString() })
          // Make sure that the user making the changes doesn't need to then accept the new agreements
          const updatedByUserMembership = await GroupMembership.forPair(updatedByUserId, this.id).fetch()
          if (updatedByUserMembership) {
            await updatedByUserMembership.save({ settings: { ...updatedByUserMembership.get('settings'), agreementsAcceptedAt: (new Date()).toISOString() } }, { transacting })
          }
        }

        await GroupAgreement.where({ group_id: this.id }).destroy({ require: false, transacting })
        let order = 1
        for (const a of agreements) {
          await GroupAgreement.forge({ group_id: this.id, agreement_id: a.id, order }).save({}, { transacting })
          order = order + 1
        }
      }

      if (changes.group_to_group_join_questions) {
        const questions = await Promise.map(changes.group_to_group_join_questions.filter(jq => trim(jq.text) !== ''), async (jq) => {
          return (await Question.where({ text: trim(jq.text) }).fetch({ transacting })) || (await Question.forge({ text: trim(jq.text) }).save({}, { transacting }))
        })
        await GroupToGroupJoinQuestion.where({ group_id: this.id }).destroy({ require: false, transacting })
        for (const q of questions) {
          await GroupToGroupJoinQuestion.forge({ group_id: this.id, question_id: q.id }).save({}, { transacting })
        }
      }

      if (changes.join_questions) {
        const questions = await Promise.map(changes.join_questions.filter(jq => trim(jq.text) !== ''), async (jq) => {
          return (await Question.where({ text: trim(jq.text) }).fetch({ transacting })) || (await Question.forge({ text: trim(jq.text) }).save({}, { transacting }))
        })
        await GroupJoinQuestion.where({ group_id: this.id }).destroy({ require: false, transacting })
        for (const q of questions) {
          await GroupJoinQuestion.forge({ group_id: this.id, question_id: q.id }).save({}, { transacting })
        }
      }

      if (changes.prerequisite_group_ids) {
        // Go through all parent groups and reset which ones are prerequisites
        const parentRelationships = await this.parentGroupRelationships().fetch({ transacting })
        await Promise.map(parentRelationships.models, async (relationship) => {
          const isNowPrereq = changes.prerequisite_group_ids.includes(relationship.get('parent_group_id'))
          if (relationship.getSetting('isPrerequisite') !== isNowPrereq) {
            await relationship.addSetting({ isPrerequisite: isNowPrereq }, true, transacting)
          }
        })
      }

      if (changes.group_extensions) {
        for (const extData of changes.group_extensions) {
          const ext = await Extension.find(extData.type)
          if (ext) {
            const ge = (await GroupExtension.find(this.id, ext.id)) || new GroupExtension({ group_id: this.id, extension_id: ext.id })
            ge.set({ data: extData.data })
            await ge.save({}, { transacting })
          } else {
            throw new GraphQLError('Invalid extension type ' + extData.type)
          }
        }
      }

      if (changes.settings && typeof changes.settings.show_welcome_page === 'boolean') {
        let welcomeView = await GroupView.where({ group_id: this.id, type: 'welcome' }).fetch({ transacting })
        if (!welcomeView && changes.settings.show_welcome_page) {
          welcomeView = await GroupView.appendToMenu({
            group_id: this.id,
            type: 'welcome'
          }, { transacting })
        }
      }
      await this.save({}, { transacting })
    })
    // If a new location is being passed in but not a new location_id then we geocode on the server
    if (changes.location && changes.location !== this.get('location') && !changes.location_id) {
      await Queue.classMethod('Group', 'geocodeLocation', { groupId: this.id })
    }

    if (this.hasMurmurationsProfile()) {
      await Queue.classMethod('Group', 'publishToMurmurations', { groupId: this.id })
    }
    return this
  },

  validate: function () {
    if (!trim(this.get('name'))) {
      return Promise.reject(new GraphQLError('Name cannot be blank'))
    }

    return Promise.resolve()
  },

  getEventCalendarPath: function () {
    return `${process.env.UPLOADER_PATH_PREFIX}/group/${this.id}/calendar-${this.get('calendar_token')}.ics`
  },

  eventCalendarUrl: function () {
    return this.get('calendar_token')
      ? `${process.env.AWS_S3_CONTENT_URL}/${this.getEventCalendarPath()}`
      : null
  }
}, HasSettings), {
  // ****** Class constants ****** //

  Visibility: {
    HIDDEN: 0,
    PROTECTED: 1,
    PUBLIC: 2
  },

  Accessibility: {
    CLOSED: 0,
    RESTRICTED: 1,
    OPEN: 2
  },

  RelationshipType: {
    PARENT_CHILD: 0,
    PEER_TO_PEER: 1
  },

  // ******* Class methods ******** //

  // Background task to do additional work/tasks when new members are added to a group
  async afterAddMembers ({ groupId, newUserIds, reactivatedUserIds }) {
    const zapierTriggers = await ZapierTrigger.forTypeAndGroups('new_member', groupId).fetchAll()

    const members = await User.query(q => q.whereIn('id', newUserIds.concat(reactivatedUserIds))).fetchAll()
    const group = await Group.find(groupId)

    // Publish group membership updates for new and reactivated members
    if (group && members.length > 0) {
      const { publishGroupMembershipUpdate } = require('../../lib/groupSubscriptionPublisher')

      for (const member of members.models) {
        const action = reactivatedUserIds.includes(member.id) ? 'rejoined' : 'joined'

        if (process.env.NODE_ENV === 'development') {
          console.log(`📡 Background job: Publishing membership update for ${member.get('name')} (${action})`)
        }

        try {
          await publishGroupMembershipUpdate(null, group, {
            group,
            member,
            action
          }, {
            additionalUserIds: [member.id] // Notify the new member
          })
        } catch (error) {
          console.error('❌ Error publishing membership update in afterAddMembers:', error)
        }
      }
    }

    if (zapierTriggers && zapierTriggers.length > 0) {
      for (const trigger of zapierTriggers) {
        await fetch(trigger.get('target_url'), {
          method: 'post',
          body: JSON.stringify(members.map(m => ({
            id: m.id,
            avatarUrl: m.get('avatar_url'),
            bio: m.get('bio'),
            contactEmail: m.get('contact_email'),
            contactPhone: m.get('contact_phone'),
            facebookUrl: m.get('facebook_url'),
            linkedinUrl: m.get('linkedin_url'),
            location: m.get('location'),
            name: m.get('name'),
            profileUrl: Frontend.Route.profile(m, group),
            tagline: m.get('tagline'),
            twitterName: m.get('twitter_name'),
            url: m.get('url'),
            // Whether this user was previously in the group and is being reactivated
            reactivated: reactivatedUserIds.includes(m.id),
            // Which group were they added to, since the trigger can be for multiple groups
            group: { id: group.id, name: group.get('name'), url: Frontend.Route.group(group) }
          }))),
          headers: { 'Content-Type': 'application/json' }
        })
        // TODO: what to do with the response? check if succeeded or not?
      }
    }

    for (const member of members) {
      mixpanel.track(AnalyticsEvents.GROUP_NEW_MEMBER, {
        distinct_id: member.id,
        groupId: [groupId]
      })
    }
  },

  // create a calendar subscription for group events
  async createEventCalendarSubscription ({ groupId }) {
    const group = await Group.find(groupId)
    if (!group) return

    if (!group.get('calendar_token')) {
      await group.save({ calendar_token: uuidv4() }, { patch: true })
      await group.refresh()
    }

    // Fetch all events for this group
    const fromDate = Post.eventCalSubDateLimit().toISO()
    const events = await group.posts().query(q => {
      q.where({ 'posts.type': 'event' })
      q.where('posts.start_time', '>', fromDate)
    }).fetch()

    // Create the calendar and add the events
    const cal = ical({
      name: `All Events for ${group.get('name')}`,
      description: `All the events in group ${group.get('name')} on Hylo`,
      scale: 'gregorian'
    })
    for (const event of events.models) {
      const calEvent = await event.getCalEventData({ url: Frontend.Route.post(event, group) })
      cal.createEvent(calEvent).uid(calEvent.uid)
    }

    // Write the combined calendar file to S3
    await writeStringToS3(
      cal.toString(),
      group.getEventCalendarPath(), {
        ContentType: 'text/calendar'
      }
    )
  },

  // Background task to do additional work/tasks after a new member finished joining a group (after they've accepted agreements and answered join questions)
  async afterFinishedJoining ({ userId, groupId }) {
    const group = await Group.find(groupId)

    const moderators = await group.moderators().fetch()

    const activities = moderators.map(moderator => ({
      actor_id: userId,
      reader_id: moderator.id,
      group_id: groupId,
      reason: 'memberJoinedGroup'
    }))

    Activity.saveForReasons(activities)
  },

  async create (userId, data) {
    if (!data.slug) {
      throw new GraphQLError('Missing required field: slug')
    }
    const existingGroup = await Group.find(data.slug)
    if (existingGroup) {
      throw new GraphQLError('A group with that URL slug already exists')
    }

    const trimAttrs = ['name', 'purpose']
    const attrs = defaults(
      pick(mapValues(data, (v, k) => trimAttrs.includes(k) ? trim(v) : v),
        'about_video_uri', 'accessibility', 'access_code', 'avatar_url', 'banner_url', 'description',
        'location_id', 'location', 'name', 'purpose', 'settings', 'slug', 'accepted_post_types',
        'steward_descriptor', 'steward_descriptor_plural', 'type', 'type_descriptor', 'type_descriptor_plural', 'visibility'
      ),
      {
        accessibility: Group.Accessibility.RESTRICTED,
        avatar_url: DEFAULT_AVATAR,
        banner_url: DEFAULT_BANNER,
        visibility: Group.Visibility.PROTECTED
      }
    )

    // XXX: for now groups by default cannot post to public on production
    attrs.allow_in_public = process.env.NODE_ENV === 'development'

    const defaultSettings = {
      allow_group_invites: false,
      agreements_last_updated_at: null,
      public_member_directory: false,
      homeView: data.home_view || 'CHAT',
      layout: 'two-column'
    }

    const homeRoute = defaultSettings.homeView === 'CHAT' ? '/chat/general' : defaultSettings.homeView === 'MAP' ? '/map' : '/all'

    // eslint-disable-next-line camelcase
    const access_code = attrs.access_code || await Group.getNewAccessCode()
    const group = new Group(merge(attrs, {
      access_code,
      created_at: new Date(),
      created_by_id: userId,
      settings: defaultSettings,
      calendar_token: uuidv4(),
      home_route: homeRoute
    }))

    await bookshelf.transaction(async trx => {
      await group.save(null, { transacting: trx })

      await GroupRole.setupSystemRoles(group.id, { transacting: trx })

      if (data.group_extensions) {
        for (const extData of data.group_extensions) {
          const ext = await Extension.find(extData.type, { transacting: trx })
          if (ext) {
            const ge = new GroupExtension({ group_id: group.id, extension_id: ext.id, data: extData.data })
            await ge.save(null, { transacting: trx })
          } else {
            throw new GraphQLError('Invalid extension type ' + extData.type)
          }
        }
      }

      // TODO: remove? we arent sure if we are using explore page anymore
      await group.createInitialWidgets(trx)

      // Seed GroupView rows from the creator's chosen Included Views
      // list (see routes/CreateGroup.jsx). Defaults to all/chat/members when omitted.
      await Group.setupSpaceViews(group.id, attrs.accepted_post_types, data.view_types, { transacting: trx })

      // Set lastReadAt when creating a new group to mark creator as having viewed the group already
      await group.addMembers([userId], { assignCoordinator: true, lastReadAt: new Date() }, { transacting: trx })

      // Have to add/request add to parent group after admin has been added to the group
      if (data.parent_ids) {
        for (const parentId of data.parent_ids) {
          const parent = await Group.findActive(parentId, { transacting: trx })

          if (parent) {
            // Spaces are containers inside a group — they can never parent a group
            if (parent.get('type') === 'space') continue
            // Only allow for adding parent groups that the creator is a moderator of or that are Open
            const parentGroupMembership = await GroupMembership.forIds(userId, parentId, {
              query: q => { q.select('group_memberships.*', 'groups.accessibility as accessibility', 'groups.visibility as visibility') }
            }).fetch({ transacting: trx })

            if (parentGroupMembership &&
                (parentGroupMembership.get('accessibility') === Group.Accessibility.OPEN ||
                  await GroupMembership.hasResponsibility(userId, parentId, Responsibility.constants.RESP_ADMINISTRATION, { transacting: trx }))) {
              await group.parentGroups().attach(parentId, { transacting: trx })
            } else {
              // If can't add directly to parent group then send a request to join
              await inviteGroupToGroup(userId, group.id, parentId, GroupRelationshipInvite.TYPE.ChildToParent, [], { transacting: trx })
            }
          }
        }
      }
    })

    if (data.location && !data.location_id) {
      await Queue.classMethod('Group', 'geocodeLocation', { groupId: group.id })
    }

    await Queue.classMethod('Group', 'notifyAboutCreate', { groupId: group.id })

    // Send email to creator
    await Queue.classMethod('Group', 'sendGroupCreatedEmail', { groupId: group.id })

    return group
  },

  async deactivate (id, opts = {}) {
    const group = await Group.find(id)
    if (group) {
      await group.save({ active: false }, opts)
      return group.removeMembers(await group.members().fetch(), opts)
    }
  },

  /**
   * Permanently delete a space group row and related non-CASCADE FK rows.
   * Archive (active = false) is handled separately via archiveSpace / deactivate.
   */
  async destroySpace (id, { transacting } = {}) {
    const space = await Group.find(id, { transacting })
    if (!space || space.get('type') !== 'space') return null

    const run = async (trx) => {
      const knex = trx || bookshelf.knex
      const spaceId = space.id

      // Detach / delete rows that block groups.id deletion.
      // funding_rounds.group_id is NOT NULL, so delete the rounds (and dependents).
      const fundingRoundIds = await knex('funding_rounds').where({ group_id: spaceId }).pluck('id')
      if (fundingRoundIds.length > 0) {
        await knex('activities').whereIn('funding_round_id', fundingRoundIds).update({ funding_round_id: null })
        await knex('groups').where({ id: spaceId }).update({ funding_round_id: null })
        await knex('funding_rounds').whereIn('id', fundingRoundIds).del()
      }

      // tracks.group_id is nullable (ON DELETE SET NULL)
      await knex('tracks').where({ group_id: spaceId }).update({ group_id: null })
      await knex('activities').where({ other_group_id: spaceId }).update({ other_group_id: null })

      const activityIds = await knex('activities').where({ group_id: spaceId }).pluck('id')
      if (activityIds.length > 0) {
        await knex('notifications').whereIn('activity_id', activityIds).del()
        await knex('activities').whereIn('id', activityIds).del()
      }

      await knex('content_access').where(builder => {
        builder.where({ group_id: spaceId }).orWhere({ granted_by_group_id: spaceId })
      }).del()

      await knex('drafts').where({ group_id: spaceId }).del()
      await knex('group_extensions').where({ group_id: spaceId }).del()
      await knex('group_invites').where({ group_id: spaceId }).del()
      await knex('group_join_questions_answers').where({ group_id: spaceId }).del()
      await knex('group_join_questions').where({ group_id: spaceId }).del()
      await knex('group_relationship_invites').where(builder => {
        builder.where({ from_group_id: spaceId }).orWhere({ to_group_id: spaceId })
      }).del()
      await knex('group_relationships').where(builder => {
        builder.where({ parent_group_id: spaceId }).orWhere({ child_group_id: spaceId })
      }).del()
      await knex('group_to_group_join_questions').where({ group_id: spaceId }).del()
      await knex('group_widgets').where({ group_id: spaceId }).del()
      await knex('groups_agreements').where({ group_id: spaceId }).del()
      await knex('groups_posts').where({ group_id: spaceId }).del()
      await knex('groups_suggested_skills').where({ group_id: spaceId }).del()
      await knex('groups_tags').where({ group_id: spaceId }).del()
      await knex('join_requests').where({ group_id: spaceId }).del()
      await knex('tag_follows').where({ group_id: spaceId }).del()
      await knex('users_groups_agreements').where({ group_id: spaceId }).del()
      await knex('zapier_triggers_groups').where({ group_id: spaceId }).del()

      const roleIds = await knex('groups_roles').where({ group_id: spaceId }).pluck('id')
      if (roleIds.length > 0) {
        await knex('group_roles_responsibilities').whereIn('group_role_id', roleIds).del()
        await knex('group_memberships_group_roles').where({ group_id: spaceId }).del()
        await knex('groups_roles').whereIn('id', roleIds).del()
      } else {
        await knex('group_memberships_group_roles').where({ group_id: spaceId }).del()
      }
      await knex('group_memberships').where({ group_id: spaceId }).del()

      const responsibilityIds = await knex('responsibilities').where({ group_id: spaceId }).pluck('id')
      if (responsibilityIds.length > 0) {
        await knex('group_roles_responsibilities').whereIn('responsibility_id', responsibilityIds).del()
        await knex('responsibilities').whereIn('id', responsibilityIds).del()
      }

      // Explicit even though CASCADE — menu rows on the parent and space views.
      await knex('group_views').where(builder => {
        builder.where({ group_id: spaceId }).orWhere({ linked_group_id: spaceId })
      }).del()

      await knex('groups').where({ id: spaceId }).del()
      return true
    }

    if (transacting) return run(transacting)
    return bookshelf.transaction(run)
  },

  // Maps accepted post types to the GroupView type shown for them, mirroring the
  // grouping used by the legacy ContextWidget menu (offer + request share one view)
  ACCEPTED_POST_TYPE_TO_VIEW_TYPE: POST_TYPE_TO_TYPED_VIEW,

  /**
   * Seeds the default `group_views` rows for a newly created space (spec section 3.4 / 10):
   * When `viewTypes` is omitted: `all` (order 0, home), `chat`, `members`, then one view per
   * accepted post type. When `viewTypes` is provided, seeds that ordered list instead
   * (used when the creator has customized the Included Views in the space creation dialog).
   * Always sets `groups.home_route` from the order-0 view. Idempotent — does nothing if the
   * space already has views.
   */
  async setupSpaceViews (spaceId, acceptedPostTypes = [], viewTypes, { transacting } = {}) {
    const existing = await GroupView.where({ group_id: spaceId }).fetchAll({ transacting })
    if (existing.length > 0) return

    const now = new Date()
    let rows

    if (viewTypes && viewTypes.length > 0) {
      rows = viewTypes.map(type => ({ type }))
    } else {
      rows = [
        { type: GroupView.Type.ALL },
        { type: GroupView.Type.CHAT },
        { type: GroupView.Type.MEMBERS }
      ]

      const seenViewTypes = new Set(rows.map(r => r.type))
      for (const postType of (acceptedPostTypes || [])) {
        const viewType = Group.ACCEPTED_POST_TYPE_TO_VIEW_TYPE[postType]
        if (viewType && !seenViewTypes.has(viewType)) {
          seenViewTypes.add(viewType)
          rows.push({ type: viewType })
        }
      }
    }

    for (let i = 0; i < rows.length; i++) {
      await GroupView.forge({
        group_id: spaceId,
        type: rows[i].type,
        order: i,
        created_at: now,
        updated_at: now
      }).save(null, { transacting })
    }

    // Persist home_route from the order-0 view so redirects work without loading all views
    if (rows.length > 0) {
      const homeRoute = GroupView.computeHomeRoutePath({ type: rows[0].type })
      const update = bookshelf.knex('groups').where({ id: spaceId }).update({ home_route: homeRoute })
      if (transacting) update.transacting(transacting)
      await update
    }
  },

  find (idOrSlug, opts = {}) {
    if (!idOrSlug) return Promise.resolve(null)

    const where = isNaN(Number(idOrSlug))
      ? (opts.active ? { slug: idOrSlug, active: true } : { slug: idOrSlug })
      : (opts.active ? { id: idOrSlug, active: true } : { id: idOrSlug })

    return this.where(where).fetch(opts)
  },

  findActive (key, opts = {}) {
    return this.find(key, merge({ active: true }, opts))
  },

  /**
   * Check if a user has a responsibility that grants full access to group content
   * Full-access responsibilities: Administration, Manage Content
   * Limited responsibilities (no content access): Add Members, etc.
   *
   * @param {String|Number} userId - User ID to check
   * @param {String|Number} groupId - Group ID to check
   * @returns {Promise<Boolean>}
   */
  hasFullAccessResponsibility: async function (userId, groupId) {
    if (!userId || !groupId) {
      return false
    }

    // Get all responsibilities for this user in this group
    const responsibilities = await Responsibility.fetchForUserAndGroupAsStrings(userId, groupId)

    // Check if user has any full-access responsibility
    const fullAccessResponsibilities = [
      Responsibility.constants.RESP_ADMINISTRATION,
      Responsibility.constants.RESP_MANAGE_CONTENT
    ]

    return responsibilities.some(resp => fullAccessResponsibilities.includes(resp))
  },

  getNewAccessCode: function () {
    const test = code => Group.where({ access_code: code }).count().then(Number)
    const loop = () => {
      const code = randomstring.generate({ length: 10, charset: 'alphanumeric' })
      return test(code).then(count => count ? loop() : code)
    }
    return loop()
  },

  geocodeLocation: async function ({ groupId }) {
    const group = await Group.find(groupId)
    if (group) {
      const geocoder = mbxGeocoder({ accessToken: process.env.MAPBOX_TOKEN })

      geocoder.forwardGeocode({
        mode: 'mapbox.places-permanent',
        query: group.get('location')
      }).send().then(async (response) => {
        const match = response.body
        if (match?.features && match?.features.length > 0) {
          const locationData = omit(LocationHelpers.convertMapboxToLocation(match.features[0]), 'mapboxId')
          const loc = await findOrCreateLocation(locationData)
          group.save({ location_id: loc.id })
        }
      })
    }
  },

  messageStewards: async function (fromUserId, groupId) {
    // Make sure they can only message a group they can see
    const group = await groupFilter(fromUserId)(Group.where({ id: groupId })).fetch()
    // TODO: ADD RESP TO THIS ONE
    if (group) {
      const stewards = await group.stewards().fetch()
      if (stewards.length > 0) {
        // HACK: add user_connection row so that the people can see each other even though they are not in the same group
        stewards.forEach(async (m) => {
          await UserConnection.create(fromUserId, m.id, UserConnection.Type.MESSAGE)
        })
        const thread = await findOrCreateThread(fromUserId, stewards.map(m => m.id))
        return thread.id
      }
    }
    return null
  },

  notifyAboutCreate: function (opts) {
    return Group.find(opts.groupId, { withRelated: ['creator'] })
      .then(g => {
        const creator = g.relations.creator
        const recipient = process.env.NEW_GROUP_EMAIL
        const L = getLocaleStrings(creator.getLocale())
        return Email.sendRawEmail({
          email: recipient,
          data: {
            subject: L.groupCreatedNotifySubject(g.get('name')),
            body: `${L.Group()}
              ${L.Name()}: ${g.get('name')}
              URL: ${Frontend.Route.group(g)}
              ${L.CreatorEmail()}: ${creator.get('email')}
              ${L.CreatorName()}: ${creator.get('name')}
              ${L.CreatorURL()}: ${Frontend.Route.profile(creator)}
            `.replace(/^\s+/gm, '').replace(/\n/g, '<br/>\n')
          },
          extraOptions: {
            sender: {
              name: 'Hylobot',
              address: 'dev+bot@hylo.com'
            }
          }
        })
      })
  },

  sendGroupCreatedEmail: function (opts) {
    return Group.find(opts.groupId, { withRelated: ['creator'] })
      .then(async group => {
        if (!group) return
        const creator = group.relations.creator
        if (!creator) return

        const userLocale = creator.getLocale()
        const userName = creator.get('name') || ''
        const firstName = userName.split(' ')[0] || userName

        Email.sendGroupCreatedEmail({
          email: creator.get('email'),
          data: {
            first_name: firstName,
            group_name: group.get('name'),
            add_purpose_url: Frontend.Route.groupSettings(group),
            edit_welcome_page_url: Frontend.Route.group(group) + '?edit=true',
            stewardship_support_url: 'https://hylozoic.gitbook.io/hylo/about/community-stewardship-support-program-csaas',
            community_call_url: 'https://www.hylo.com/participate/'
          },
          locale: userLocale
        })
      })
  },

  notifySlack: function (groupId, post) {
    return Group.find(groupId)
      .then(group => {
        if (!group || !group.get('slack_hook_url')) return
        const slackMessage = Slack.textForNewPost(post, group)
        return Slack.send(slackMessage, group.get('slack_hook_url'))
      })
  },

  publishToMurmurations: async function ({ groupId }) {
    const group = await Group.find(groupId)
    if (group) {
      sails.log.info('Publishing to Murmurations', groupId, group.murmurationsProfileUrl())
      // post murmurations profile data to Murmurations index (https://app.swaggerhub.com/apis-docs/MurmurationsNetwork/IndexAPI/2.0.0#/Node%20Endpoints/post_nodes)
      const response = await fetch(process.env.MURMURATIONS_INDEX_API_URL, {
        method: 'POST',
        body: JSON.stringify({ profile_url: group.murmurationsProfileUrl() }),
        headers: { 'Content-Type': 'application/json' }
      })
      const responseJSON = await response.json()
      if (response.ok) {
        return responseJSON
      } else {
        sails.log.error('Group.publishToMurmurations error', response.status, response.statusText, responseJSON)
        throw new Error(`Failed to publish to Murmurations: ${response.status}: ${response.statusText} - ${responseJSON.message}`)
      }
    }
  },

  async pluckIdsForMember (userOrId, where) {
    return await this.selectIdsForMember(userOrId, where).pluck('groups.id')
  },

  postCount: function (groupId, includeChat = true) {
    return Post.query(q => {
      q.select(bookshelf.knex.raw('count(*)'))
      q.join('groups_posts', 'posts.id', 'groups_posts.post_id')
      q.where({ 'groups_posts.group_id': groupId, active: true })
      if (!includeChat) {
        q.where('posts.type', '!=', 'chat')
      }
    })
      .fetch()
      .then(result => result.get('count'))
  },

  queryByAccessCode: function (accessCode) {
    return this.query(qb => {
      qb.whereRaw('lower(access_code) = lower(?)', accessCode)
      qb.where('active', true)
    })
  },

  selectIdsForMember (userOrId, where) {
    return GroupMembership.forIds(userOrId, null, {
      query: q => {
        q.select('groups.id')
        q.join('groups', 'groups.id', 'group_memberships.group_id')
        q.where('groups.active', true)
        if (where) q.where(where)
      },
      multiple: true
    }).query()
  },

  /**
   * Restrict a groups query to non-space rows. Matches digest recipient
   * filtering: type is null or anything other than 'space'. Do not filter on
   * parent_id — list UIs that fetch by id (featured, menu preload) and any
   * top-level group that happens to have parent_id set must still appear.
   */
  excludeSpaces (q) {
    q.where(function () {
      this.whereNull('groups.type').orWhere('groups.type', '<>', 'space')
    })
    return q
  },

  /**
   * Group/space ids where the user is a member and holds any of the responsibilities.
   * Spaces inherit role assignments from their parent group.
   */
  selectIdsByResponsibilities (userOrId, responsibilities) {
    const useTitles = responsibilities.some(r => typeof r === 'string' && Number.isNaN(Number(r)))
    const throughGroupRole = MemberGroupRole.collection().query(q => {
      q.select('group_memberships_group_roles.group_id')
      whereId(q, userOrId, 'group_memberships_group_roles.user_id')
      q.join('group_roles_responsibilities', 'group_roles_responsibilities.group_role_id', 'group_memberships_group_roles.group_role_id')
      if (useTitles) {
        q.join('responsibilities', 'responsibilities.id', 'group_roles_responsibilities.responsibility_id')
        q.whereIn('responsibilities.title', responsibilities)
      } else {
        q.whereIn('group_roles_responsibilities.responsibility_id', responsibilities)
      }
    })

    return GroupMembership.forIds(userOrId, null, {
      query: q => {
        q.select('groups.id')
        q.join('groups', 'groups.id', 'group_memberships.group_id')
        q.where('groups.active', true)
        // Direct role on this group, or (for spaces) role on parent_id
        q.where(function () {
          this.whereIn('groups.id', throughGroupRole.query())
            .orWhereIn('groups.parent_id', throughGroupRole.query())
        })
      },
      multiple: true
    }).query()
  },

  /**
   * Group id whose groups_roles / role assignments apply for this group.
   * Spaces use parent_id; top-level groups use their own id.
   */
  async roleScopeId (groupOrId) {
    const groupId = groupOrId instanceof Group ? groupOrId.id : groupOrId
    if (!groupId) return groupId
    if (groupOrId instanceof Group && groupOrId.get('parent_id') != null) {
      return groupOrId.get('parent_id')
    }
    if (groupOrId instanceof Group && groupOrId.has('parent_id')) {
      return groupOrId.id
    }
    const row = await bookshelf.knex('groups').where('id', groupId).select('id', 'parent_id').first()
    if (!row) return groupId
    return row.parent_id || row.id
  },

  async allHaveMember (groupDataIds, userOrId) {
    const memberIds = await this.pluckIdsForMember(userOrId)
    return difference(groupDataIds, memberIds).length === 0
  },

  havingExactMembers (userIds) {
    userIds = sortBy(userIds, Number)
    return this.query(q => {
      q.join('group_memberships', 'groups.id', 'group_memberships.group_id')
      q.where('group_memberships.active', true)
      q.groupBy('groups.id')
      q.having(bookshelf.knex.raw('array_agg(user_id order by user_id) = ?', [userIds]))
    })
  },

  async inSameGroup (userIds) {
    const groupIds = await Promise.all(userIds.map(id => this.pluckIdsForMember(id)))
    return intersection(groupIds).length > 0
  },

  isSlugValid: function (slug) {
    const regex = /^[0-9a-z-]{2,40}$/
    return regex.test(slug)
  },

  updateAllMemberCounts () {
    return bookshelf.knex.raw('update groups set num_members = (select count(group_memberships.*) from group_memberships inner join users on users.id = group_memberships.user_id where group_memberships.active = true and users.active = true and group_memberships.group_id = groups.id)')
  },

  /**
   * Atomically adjust the cached pending join-request count.
   * Uses increment / GREATEST so concurrent create/accept cannot race a read-modify-write.
   */
  async adjustOpenJoinRequestCount (groupId, delta, transacting) {
    if (!groupId || !delta) return
    const knex = transacting || bookshelf.knex
    if (delta > 0) {
      await knex('groups').where('id', groupId).increment('num_open_join_requests', delta)
    } else {
      await knex.raw(
        'UPDATE groups SET num_open_join_requests = GREATEST(0, COALESCE(num_open_join_requests, 0) + ?) WHERE id = ?',
        [delta, groupId]
      )
    }
    if (!transacting) await Group.broadcastOpenJoinRequestCount(groupId)
  },

  /**
   * Push the current open join-request count to group/parent rooms and stewards.
   */
  async broadcastOpenJoinRequestCount (groupId) {
    try {
      const row = await bookshelf.knex('groups')
        .where('id', groupId)
        .select('id', 'parent_id', 'num_open_join_requests')
        .first()
      if (!row) return

      const payload = {
        groupId: String(row.id),
        openJoinRequestCount: Number(row.num_open_join_requests) || 0
      }
      const rooms = [groupRoom(row.id)]
      if (row.parent_id) rooms.push(groupRoom(row.parent_id))

      const stewardRows = await Responsibility.fetchForGroup(groupId)
      const stewardIds = [...new Set(
        stewardRows
          .filter(r => r.responsibility_title === Responsibility.constants.RESP_ADD_MEMBERS)
          .map(r => r.user_id)
      )]

      await Promise.all([
        ...rooms.map(room => pushToSockets(room, 'openJoinRequestCountUpdated', payload)),
        ...stewardIds.map(id => pushToSockets(userRoom(id), 'openJoinRequestCountUpdated', payload))
      ])
    } catch (err) {
      if (typeof sails !== 'undefined' && sails.log) {
        sails.log.error('broadcastOpenJoinRequestCount failed', err)
      }
    }
  }
})
