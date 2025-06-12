/* eslint-disable camelcase */

module.exports = bookshelf.Model.extend({
  tableName: 'groups_tags',
  requireFetch: false,
  hasTimestamps: true,

  initialize: function () {
    this._tagFollowCache = {}
  },

  owner: function () {
    return this.belongsTo(User, 'user_id')
  },

  group: function () {
    return this.belongsTo(Group)
  },

  tag: function () {
    return this.belongsTo(Tag)
  },

  tagFollow: function (userId) {
    return TagFollow.query(q => {
      q.where({
        user_id: userId,
        group_id: this.get('group_id'),
        tag_id: this.get('tag_id')
      })
    })
  },

  // Method to load and cache tagFollow data
  _loadTagFollow: function (userId) {
    if (!this._tagFollowCache[userId]) {
      this._tagFollowCache[userId] = this.tagFollow(userId).fetch()
    }
    return this._tagFollowCache[userId]
  },

  isFollowed: function (userId) {
    return this._loadTagFollow(userId).then(tagFollow => tagFollow !== null)
  },

  lastReadPostId: function (userId) {
    return this._loadTagFollow(userId).then(tagFollow => tagFollow ? tagFollow.get('last_read_post_id') : null)
  },

  newPostCount: function (userId) {
    return this._loadTagFollow(userId).then(tagFollow => tagFollow ? tagFollow.get('new_post_count') : 0)
  },

  postCount: function () {
    return GroupTag.taggedPostCount(this.get('group_id'), this.get('tag_id'))
  },

  followerCount: function () {
    return Tag.followersCount(this.get('tag_id'), { groupId: this.get('group_id') })
  },

  consolidateFollowerCount: function () {
    return this.followerCount()
      .then(num_followers => {
        if (num_followers === this.get('num_followers')) return Promise.resolve()
        return this.save({ num_followers })
      })
  }

}, {

  create (attrs, { transacting } = {}) {
    return this.forge(Object.assign({ created_at: new Date(), updated_at: new Date() }, attrs))
      .save({}, { transacting })
  },

  taggedPostCount (groupId, tagId, afterPostId = false) {
    const query = bookshelf.knex('posts_tags')
      .join('posts', 'posts.id', 'posts_tags.post_id')
      .join('groups_posts', 'groups_posts.post_id', 'posts_tags.post_id')
      .where('posts.active', true)
      .where({ group_id: groupId, tag_id: tagId })

    if (afterPostId) {
      query.where('posts.id', '>', afterPostId)
    }

    return query.count().then(rows => Number(rows[0].count))
  },

  defaults (groupId, trx) {
    return GroupTag.where({ group_id: groupId, is_default: true })
      .fetchAll({ withRelated: 'tag', transacting: trx })
  },

  findByTagAndGroup (topicName, groupSlug) {
    return GroupTag.query(q => {
      q.join('groups', 'groups.id', 'groups_tags.group_id')
      q.where('groups.slug', groupSlug)
      q.join('tags', 'tags.id', 'groups_tags.tag_id')
      q.where('tags.name', topicName)
    }).fetch()
  }
})
