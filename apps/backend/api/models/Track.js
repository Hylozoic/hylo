/* global bookshelf, Group, GroupMembership, GroupRole, GroupView, CollectionPost, Post, User, UserScope, Activity, Responsibility, RichText, Track */
/* eslint-disable camelcase  */
import { GraphQLError } from 'graphql'
import HasSettings from './mixins/HasSettings' // TODO: does it have settings?
import uniq from 'lodash/uniq'
const { createTrackScope } = require('../../lib/scopes')

/** Active space membership for a track enrollee (join space = enrolled). */
function enrollmentMembership (track, userId, { transacting } = {}) {
  const groupId = track.get('group_id')
  if (!groupId || !userId) return Promise.resolve(null)
  return GroupMembership.forPair(userId, groupId).fetch({ transacting })
}

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tracks',
  requireFetch: false,
  hasTimestamps: true,

  completionRole: function () {
    return this.belongsTo(GroupRole, 'completion_role_id')
  },

  /**
   * Users enrolled in this track = active members of the Track space.
   * Person.enrolledAt comes from membership created_at; completedAt from settings.
   */
  enrolledUsers: function () {
    return this.belongsToMany(User, 'group_memberships', 'group_id', 'user_id', 'group_id')
      .query(q => {
        q.where('group_memberships.active', true)
      })
      .orderBy('users.name', 'asc')
      .withPivot(['settings', 'created_at'])
  },

  /** The Track's space Group via tracks.group_id (1:1). */
  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  /** The Track space Group via groups.track_id (inverse of group()). */
  space: function () {
    return this.hasOne(Group, 'track_id')
  },

  // Getter to override access to the completion_message attribute and sanitize the HTML
  completionMessage: function () {
    return RichText.processHTML(this.get('completion_message'))
  },

  didComplete: async function (userId) {
    const membership = await enrollmentMembership(this, userId)
    return !!(membership && membership.get('active') && membership.get('settings')?.completedAt)
  },

  /**
   * Check if a user has access to this track
   * If track is not access controlled, returns true (free access)
   * Otherwise checks: 1) full-access responsibilities in parent group, 2) scope-based access
   * @param {String|Number} userId - User ID to check
   * @returns {Promise<Boolean>}
   */
  canAccess: async function (userId) {
    // If track is not access controlled, it's freely accessible
    if (!this.get('access_controlled')) {
      return true
    }

    if (!userId) {
      return false
    }

    // Check if user has full-access responsibility in parent group (admin or content manager)
    const groupId = this.get('group_id')
    if (groupId) {
      const hasFullAccess = await Group.hasFullAccessResponsibility(userId, groupId)
      if (hasFullAccess) {
        return true
      }
    }

    // Check scope-based access (purchased or granted)
    const trackId = this.get('id')
    const requiredScope = createTrackScope(trackId)
    return await UserScope.canAccess(userId, requiredScope)
  },

  isEnrolled: async function (userId) {
    const membership = await enrollmentMembership(this, userId)
    return !!(membership && membership.get('active'))
  },

  userSettings: async function (userId) {
    const membership = await enrollmentMembership(this, userId)
    return membership && membership.get('active') ? membership.get('settings') : null
  },

  /** Display name lives on the Track space group. */
  displayName: async function ({ transacting } = {}) {
    if (this.relations.group) return this.relations.group.get('name') || ''
    const space = await this.group().fetch({ transacting })
    return space ? space.get('name') : ''
  },

  /** Description lives on the Track space group. */
  displayDescription: async function ({ transacting } = {}) {
    if (this.relations.group) return this.relations.group.get('description') || ''
    const space = await this.group().fetch({ transacting })
    return space ? space.get('description') : ''
  },

  /** Ordered action Posts from the Track space's track-actions view. */
  actionPosts: async function ({ transacting } = {}) {
    const group = await this.group().fetch({ transacting })
    return group ? group.actionPosts({ transacting }) : []
  },

  duplicate: async function () {
    return bookshelf.transaction(async trx => {
      const newTrack = await this.clone()
      delete newTrack.attributes.id
      delete newTrack.id
      await newTrack.save({
        num_actions: 0,
        num_people_enrolled: 0,
        num_people_completed: 0,
        group_id: null
      }, { transacting: trx })

      // Clone the Track space (if any) so the copy has a track-actions view
      const sourceSpace = await this.group().fetch({ transacting: trx })
      let copySpace = null
      if (sourceSpace && sourceSpace.get('type') === 'space') {
        copySpace = await sourceSpace.clone()
        delete copySpace.attributes.id
        delete copySpace.id
        const accessCode = await Group.getNewAccessCode()
        await copySpace.save({
          name: (sourceSpace.get('name') || 'Track') + ' (copy)',
          slug: `${sourceSpace.get('slug')}-copy-${Date.now()}`.slice(0, 40),
          access_code: accessCode,
          track_id: newTrack.id,
          status: Group.Status.DRAFT,
          created_at: new Date(),
          num_members: 0,
          num_open_join_requests: 0
        }, { transacting: trx })
        await newTrack.save({ group_id: copySpace.id }, { patch: true, transacting: trx })
        await Group.setupSpaceViews(copySpace.id, sourceSpace.get('accepted_post_types') || [], ['track-actions', 'members', 'welcome'], { transacting: trx })
      }

      // Duplicate actions from the track-actions collections_posts list
      const trackActions = await this.actionPosts({ transacting: trx })
      let order = 0
      for (const action of trackActions) {
        const newAction = await action.clone()
        delete newAction.attributes.id
        delete newAction.id
        await newAction.save({
          created_at: new Date(),
          updated_at: new Date(),
          num_people_reacts: 0,
          num_comments: 0,
          num_people_completed: 0
        }, { transacting: trx })
        if (copySpace) {
          await newAction.groups().attach([copySpace.id], { transacting: trx })
          await Track.addPost(newAction, newTrack, { transacting: trx, order })
          order += 1
        }
      }

      return newTrack
    })
  }

}, HasSettings), {
  addPost: async function (postOrId, trackOrId, { transacting, order, userId } = {}) {
    const post = typeof postOrId === 'object' ? postOrId : await Post.find(postOrId, { transacting })
    const postId = post ? post.get('id') : postOrId
    const track = await (typeof trackOrId === 'object' ? trackOrId : Track.find(trackOrId))
    if (!track) {
      throw new GraphQLError('Track not found')
    }

    const spaceGroup = await track.group().fetch({ transacting })
    if (!spaceGroup) {
      throw new GraphQLError('Track space actions view not found')
    }
    const actionsView = await spaceGroup.trackActionsView().fetch({ transacting })
    if (!actionsView) {
      throw new GraphQLError('Track space actions view not found')
    }

    const existing = await CollectionPost.find(actionsView.id, postId, { transacting })
    if (existing) return existing

    await track.save({ num_actions: track.get('num_actions') + 1 }, { transacting })

    let nextOrder = order
    if (nextOrder == null) {
      let maxOrderQuery = bookshelf.knex('collections_posts')
        .where({ view_id: actionsView.id })
        .select(bookshelf.knex.raw('coalesce(max("order"), -1) as max_order'))
        .first()
      if (transacting) maxOrderQuery = maxOrderQuery.transacting(transacting)
      const row = await maxOrderQuery
      nextOrder = Number(row.max_order) + 1
    }

    const resolvedUserId = userId || (post && post.get('user_id'))
    return CollectionPost.create({
      view_id: actionsView.id,
      post_id: postId,
      order: nextOrder,
      user_id: resolvedUserId
    }, { transacting })
  },

  create: async function (attrs, { transacting } = {}) {
    attrs.settings = attrs.settings || { }
    // Dual-write display fields onto leftover NOT NULL columns until the
    // in-progress drop-column migration ships. Source of truth is the space group.
    if (!attrs.name) {
      const space = attrs.group_id ? await Group.find(attrs.group_id, { transacting }) : null
      attrs.name = (space && space.get('name')) || 'Untitled'
      if (attrs.description === undefined) attrs.description = space ? space.get('description') : null
      if (attrs.banner_url === undefined) attrs.banner_url = space ? space.get('banner_url') : null
    }
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  },

  /**
   * Enroll a user in a track by joining the Track space. Returns the GroupMembership.
   */
  enroll: async function (trackId, userId) {
    return bookshelf.transaction(async trx => {
      const track = await Track.find(trackId, { transacting: trx })
      if (!track || track.get('deactivated_at') !== null) {
        throw new GraphQLError('Track not found')
      }
      const space = await track.group().fetch({ transacting: trx })
      if (!space) {
        throw new GraphQLError('Track space not found')
      }
      const status = space.get('status')
      if (status === Group.Status.DRAFT || status === Group.Status.ARCHIVED) {
        throw new GraphQLError('Track is not published')
      }

      let membership = await GroupMembership.forPair(userId, space, { includeInactive: true }).fetch({ transacting: trx })
      if (membership && membership.get('active')) {
        return membership
      }

      const created = await space.addMembers([userId], {}, { transacting: trx })
      membership = created[0] || await GroupMembership.forPair(userId, space).fetch({ transacting: trx })
      // Fresh enrollment period: clear prior completion and reset created_at (enrolledAt)
      membership.removeSetting('completedAt')
      await membership.save({
        created_at: new Date(),
        settings: membership.get('settings')
      }, { patch: true, transacting: trx })

      await track.save({ num_people_enrolled: track.get('num_people_enrolled') + 1 }, { transacting: trx })

      // Notify track managers on the parent group (responsibilities live there)
      const notifyGroupId = space.get('parent_id') || space.id
      const notifyGroup = space.get('parent_id')
        ? await Group.find(space.get('parent_id'), { transacting: trx })
        : space
      if (!notifyGroup) {
        return membership
      }
      const adminResponsibility = await Responsibility.where({ title: Responsibility.constants.RESP_ADMINISTRATION }).fetch({ transacting: trx })
      if (!adminResponsibility) {
        return membership
      }
      const stewards = await notifyGroup.membersWithResponsibilities([adminResponsibility.id]).fetch({ transacting: trx })
      const stewardsIds = stewards.pluck('id')
      const activities = stewardsIds.map(stewardId => ({
        reason: 'trackEnrollment',
        actor_id: userId,
        group_id: notifyGroupId,
        reader_id: stewardId,
        track_id: track.id
      }))
      await Activity.saveForReasons(activities, { transacting: trx })
      return membership
    })
  },

  find: function (trackId) {
    if (!trackId) return Promise.resolve(null)
    return Track.where({ id: trackId }).fetch()
  },

  /**
   * Leave a track by leaving the Track space (deactivates membership).
   */
  leave: async function (trackId, userId) {
    return bookshelf.transaction(async trx => {
      const track = await Track.find(trackId)
      if (!track) {
        throw new GraphQLError('Track not found')
      }
      const space = await track.group().fetch({ transacting: trx })
      if (!space) return null

      const membership = await enrollmentMembership(track, userId, { transacting: trx })
      if (!membership || !membership.get('active')) {
        return null
      }
      // num_people_enrolled and the completedAt setting are settled by Group.removeMembers,
      // so that leaving the parent group cascades the same way.
      await space.removeMembers([userId], { transacting: trx })
      return membership
    })
  },

  /**
   * Archive the Track space when deactivating a track. Keeps memberships intact.
   */
  deactivate: async function ({ trackId, transacting }) {
    const track = await Track.find(trackId, { transacting })
    if (!track || !track.get('group_id')) return

    const space = await Group.find(track.get('group_id'), { transacting })
    if (!space) return

    await space.save({ status: Group.Status.ARCHIVED }, { patch: true, transacting })
  },

  // When a post is deactivated, remove it from any track-actions collections and update num_actions
  removePost: async function (postId, trx) {
    const collectionRows = await CollectionPost.query(q => {
      q.join('group_views', 'group_views.id', 'collections_posts.view_id')
      q.where('collections_posts.post_id', postId)
      q.where('group_views.type', GroupView.Type.TRACK_ACTIONS)
    }).fetchAll({ transacting: trx })

    if (collectionRows.length === 0) return

    const viewIds = uniq(collectionRows.map(row => row.get('view_id')))
    const views = await GroupView.query(q => q.whereIn('id', viewIds)).fetchAll({ transacting: trx })
    const spaceGroupIds = uniq(views.map(v => v.get('group_id')))
    const spaceGroups = await Group.query(q => {
      q.whereIn('id', spaceGroupIds)
      q.whereNotNull('track_id')
    }).fetchAll({ transacting: trx })

    await Promise.all(collectionRows.map(row => row.destroy({ transacting: trx })))

    await Promise.all(spaceGroups.map(async spaceGroup => {
      const track = await Track.find(spaceGroup.get('track_id'))
      if (track) {
        await track.save({ num_actions: Math.max(0, track.get('num_actions') - 1) }, { transacting: trx })
      }
    }))
  }
})
