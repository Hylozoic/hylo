/* eslint-disable camelcase  */
import HasSettings from './mixins/HasSettings' // TODO: does it have settings?

module.exports = bookshelf.Model.extend(Object.assign({
  tableName: 'tracks_users',
  requireFetch: false,
  hasTimestamps: true,

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  track: function () {
    return this.belongsTo(Track, 'track_id')
  },

  user: function () {
    return this.belongsTo(User, 'user_id')
  }

}, HasSettings), {
  create: async function (attrs, { transacting } = {}) {
    attrs.settings = attrs.settings || { }
    return this.forge(Object.assign({ created_at: new Date() }, attrs)).save({}, { transacting })
  },

  enroll: function (trackId, userId, groupId) {
    return TrackUser.where({ track_id: trackId, user_id: userId, group_id: groupId })
      .fetch()
      .then(trackUser => {
        if (trackUser) {
          return trackUser.save({ enrolled_at: new Date() })
        } else {
          return TrackUser.create({ track_id: trackId, user_id: userId, group_id: groupId, enrolled_at: new Date() })
        }
      })
  },

  deactivate: async function ({ trackId, transacting }) {
    const trackUser = await TrackUser.where({ track_id: trackId })
    if (!trackUser) {
      return
    }

    return trackUser.save({ deactivated_at: new Date() }, { transacting })
  },

  selectIdsForMember: function (userId, where) {
    return TrackUser.where({ user_id: userId }).where(where).pluck('track_id')
  }
})
