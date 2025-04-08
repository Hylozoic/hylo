/* global bookshelf, Group, Post, User */
/* eslint-disable camelcase  */
import { GraphQLError } from 'graphql'
import HasSettings from './mixins/HasSettings' // TODO: does it have settings?

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tracks',
  requireFetch: false,
  hasTimestamps: true,

  initialize: function () {
    this._trackUserCache = {}
  },

  groups: function () {
    return this.belongsToMany(Group, 'groups_tracks')
  },

  posts: function () {
    return this.belongsToMany(Post, 'tracks_posts')
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

  isEnrolled: function (userId) {
    // this._loadTrackUser(userId).then(trackUser => console.log('trackUserxxyyzz1122', userId, trackUser, trackUser.get('enrolled_at')))
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('enrolled_at') !== null)
  },

  didComplete: function (userId) {
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('completed_at') !== null)
  },

  userSettings: function (userId) {
    return this._loadTrackUser(userId).then(trackUser => trackUser && trackUser.get('settings'))
  },

  enrolledCount: function () {
    return this.trackUser().count()
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
      q.orderBy('order', 'desc')
      q.limit(1)
    }).fetch().then(tp => (tp ? tp.get('order') : 0))

    return TrackPost.create({
      track_id: track.get('id'),
      post_id: postId,
      order: maxOrder + 1
    }, { transacting })
  },

  create: async function (attrs, { transacting } = {}) {
    attrs.settings = attrs.settings || { }
    console.log('attrs', attrs)
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  },

  enroll: async function (trackId, userId) {
    const track = await Track.find(trackId)
    if (!track || track.get('deactivated_at') !== null) {
      throw new GraphQLError('Track not found')
    }
    if (!track.get('published_at')) {
      throw new GraphQLError('Track is not published')
    }
    return TrackUser.where({ track_id: trackId, user_id: userId })
      .fetch()
      .then(trackUser => {
        if (trackUser) {
          if (!trackUser.get('enrolled_at')) {
            track.save({ num_people_enrolled: track.get('num_people_enrolled') + 1 })
            return trackUser.save({ enrolled_at: new Date() })
          }
          return trackUser
        } else {
          track.save({ num_people_enrolled: track.get('num_people_enrolled') + 1 })
          return TrackUser.create({ track_id: trackId, user_id: userId, enrolled_at: new Date() })
        }
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
  }
})
