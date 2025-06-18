/* global bookshelf, Group, Post, User */
/* eslint-disable camelcase  */
import { GraphQLError } from 'graphql'
import HasSettings from './mixins/HasSettings' // TODO: does it have settings?
import uniq from 'lodash/uniq'

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tracks',
  requireFetch: false,
  hasTimestamps: true,

  initialize: function () {
    this._trackUserCache = {}
  },

  completionRole: function () {
    if (this.get('completion_role_type') === 'common') {
      return this.belongsTo(CommonRole, 'completion_role_id')
    } else {
      return this.belongsTo(GroupRole, 'completion_role_id')
    }
  },

  enrolledUsers: function () {
    return this.belongsToMany(User, 'tracks_users', 'track_id', 'user_id').query(q => {
      q.whereNotNull('tracks_users.enrolled_at')
    }).orderBy('users.name', 'asc').withPivot(['enrolled_at', 'completed_at'])
  },

  groups: function () {
    return this.belongsToMany(Group, 'groups_tracks')
  },

  posts: function () {
    return this.belongsToMany(Post, 'tracks_posts')
      .query(q => {
        q.where('posts.active', true)
        q.where('posts.type', Post.Type.ACTION)
      })
      .withPivot('sort_order')
      .orderBy('tracks_posts.sort_order', 'asc')
  },

  users: function () {
    return this.belongsToMany(User, 'tracks_users', 'track_id', 'user_id')
  },

  trackUser: function (userId) {
    return TrackUser.query(q => {
      q.where({
        user_id: userId,
        track_id: this.get('id')
      })
    })
  },

  // Method to load and cache tagFollow data
  _loadTrackUser: function (userId) {
    if (!this._trackUserCache[userId]) {
      this._trackUserCache[userId] = this.trackUser(userId).fetch()
    }
    return this._trackUserCache[userId]
  },

  // Getter to override access to the completion_message attribute and sanitize the HTML
  completionMessage: function () {
    return RichText.processHTML(this.get('completion_message'))
  },

  didComplete: function (userId) {
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('completed_at') !== null)
  },

  enrolledCount: function () {
    return this.trackUser().count()
  },

  isEnrolled: function (userId) {
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('enrolled_at') !== null)
  },

  userSettings: function (userId) {
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('settings'))
  },

  // Getter to override access to the welcome_message attribute and sanitize the HTML
  welcomeMessage: function () {
    return RichText.processHTML(this.get('welcome_message'))
  },

  duplicate: async function () {
    return bookshelf.transaction(async trx => {
      const newTrack = await this.clone()
      delete newTrack.attributes.id
      delete newTrack.id
      await newTrack.save({
        name: this.get('name') + ' (copy)',
        num_people_enrolled: 0,
        num_people_completed: 0,
        published_at: null
      }, { transacting: trx })

      const groups = await this.groups().fetch({ transacting: trx })
      await newTrack.groups().attach(groups.map(group => ({ group_id: group.id, created_at: new Date() })), { transacting: trx })

      // Duplicate all the actions in the track
      const trackActions = await this.posts().fetch({ transacting: trx })

      await Promise.all(trackActions.map(async action => {
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
        await newAction.groups().attach(groups.map(group => group.id), { transacting: trx })
        return TrackPost.create({ track_id: newTrack.get('id'), post_id: newAction.id, sort_order: action.pivot.get('sort_order') }, { transacting: trx })
      }))

      return newTrack
    })
  }

}, HasSettings), {
  addPost: async function (postOrId, trackOrId, { transacting } = {}) {
    const postId = typeof postOrId === 'number' ? postOrId : postOrId.get('id')
    const track = await (typeof trackOrId === 'object' ? trackOrId : Track.find(trackOrId))
    if (!track) {
      throw new GraphQLError('Track not found')
    }

    await track.save({ num_actions: track.get('num_actions') + 1 }, { transacting })

    const maxOrder = await TrackPost.query(q => {
      q.where('track_id', track.get('id'))
      q.orderBy('sort_order', 'desc')
      q.limit(1)
    }).fetch().then(tp => (tp ? tp.get('sort_order') : 0))

    return TrackPost.create({
      track_id: track.get('id'),
      post_id: postId,
      sort_order: maxOrder + 1
    }, { transacting })
  },

  create: async function (attrs, { transacting } = {}) {
    attrs.settings = attrs.settings || { }
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  },

  enroll: async function (trackId, userId) {
    return bookshelf.transaction(async trx => {
      const track = await Track.find(trackId, { transacting: trx })
      if (!track || track.get('deactivated_at') !== null) {
        throw new GraphQLError('Track not found')
      }
      if (!track.get('published_at')) {
        throw new GraphQLError('Track is not published')
      }
      let trackUser = await TrackUser.where({ track_id: trackId, user_id: userId }).fetch({ transacting: trx })
      if (!trackUser) {
        trackUser = TrackUser.forge({ track_id: trackId, user_id: userId })
      }
      if (!trackUser.get('enrolled_at')) {
        await track.save({ num_people_enrolled: track.get('num_people_enrolled') + 1 }, { transacting: trx })
        await trackUser.save({ enrolled_at: new Date() }, { transacting: trx })

        const group = await track.groups().fetchOne({ transacting: trx })
        const manageTracksResponsibility = await Responsibility.where({ title: Responsibility.constants.RESP_MANAGE_TRACKS }).fetch({ transacting: trx })
        const stewards = await group.membersWithResponsibilities([manageTracksResponsibility.id]).fetch({ transacting: trx })
        const stewardsIds = stewards.pluck('id')
        const activities = stewardsIds.map(stewardId => ({
          reason: 'trackEnrollment',
          actor_id: userId,
          group_id: group.id,
          reader_id: stewardId,
          track_id: track.id
        }))
        await Activity.saveForReasons(activities, { transacting: trx })
      }
      return trackUser
    })
  },

  find: function (trackId) {
    if (!trackId) return Promise.resolve(null)
    return Track.where({ id: trackId }).fetch()
  },

  leave: async function (trackId, userId) {
    const track = await Track.find(trackId)
    if (!track) {
      throw new GraphQLError('Track not found')
    }
    return TrackUser.where({ track_id: trackId, user_id: userId })
      .fetch()
      .then(trackUser => {
        if (trackUser && trackUser.get('enrolled_at')) {
          track.save({ num_people_enrolled: track.get('num_people_enrolled') - 1 })
          return trackUser.save({ enrolled_at: null })
        }
        return null
      })
  },

  deactivate: async function ({ trackId, transacting }) {
    const trackUser = await TrackUser.where({ track_id: trackId })
    if (!trackUser) {
      return
    }

    return trackUser.save({ deactivated_at: new Date() }, { transacting })
  },

  // When a post is deactivated, we need to update the track's num_actions
  removePost: async function (postId, trx) {
    const trackPosts = await TrackPost.where({ post_id: postId }).fetchAll({ transacting: trx })
    const trackIds = uniq(trackPosts.pluck('track_id'))
    if (trackIds.length === 0) {
      return
    }
    const tracks = await Track.query(q => q.whereIn('id', trackIds)).fetchAll({ transacting: trx })

    await Promise.all(tracks.map(async track => {
      await track.save({ num_actions: track.get('num_actions') - 1 }, { transacting: trx })
    }))
  }
})
