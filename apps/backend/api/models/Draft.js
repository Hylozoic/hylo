/* global bookshelf, User, Post, Group, Draft */
module.exports = bookshelf.Model.extend({
  tableName: 'drafts',
  requireFetch: false,
  hasTimestamps: true,

  user: function () {
    return this.belongsTo(User)
  },

  post: function () {
    return this.belongsTo(Post)
  },

  messageThread: function () {
    return this.belongsTo(Post, 'message_thread_id')
  },

  group: function () {
    return this.belongsTo(Group)
  }
}, {
  /** Returns the unique draft for a given context, or null */
  findForContext: function (userId, { type, postId, groupId, topicId, messageThreadId, isEdit }) {
    const query = Draft.where({ user_id: userId, type })

    if (type === 'post' && isEdit) {
      query.where({ post_id: postId, is_edit: true })
    } else if (type === 'post') {
      query.where({ is_edit: false })
      if (groupId) query.where({ group_id: groupId })
      if (topicId) {
        query.where({ topic_id: topicId })
      } else {
        query.query(qb => qb.whereNull('topic_id'))
      }
    } else if (type === 'comment') {
      query.where({ post_id: postId })
    } else if (type === 'message') {
      query.where({ message_thread_id: messageThreadId })
    }

    return query.fetch({ require: false })
  }
})
