import { GraphQLError } from 'graphql'
import { values, isEmpty, trim } from 'lodash'
import { Validators } from '@hylo/shared'
import { notifyModeratorsPost, notifyModeratorsMember, notifyModeratorsComment } from './flaggedItem/notifyUtils'

module.exports = bookshelf.Model.extend({
  tableName: 'flagged_items',
  requireFetch: false,

  user: function () {
    return this.belongsTo(User, 'user_id')
  },

  getObject: function () {
    if (!this.get('object_id')) {
      return Promise.reject(new GraphQLError('No object_id defined for Flagged Item'))
    }
    switch (this.get('object_type')) {
      case FlaggedItem.Type.POST:
        return Post.find(this.get('object_id'), { withRelated: ['groups', 'tags'] })
      case FlaggedItem.Type.COMMENT:
        return Comment.find(this.get('object_id'), { withRelated: 'post.groups' })
      case FlaggedItem.Type.MEMBER:
        return User.find(this.get('object_id'))
      default:
        return Promise.reject(new GraphQLError('Unsupported type for Flagged Item: ' + this.get('object_type')))
    }
  },

  async getMessageText (group) {
    const link = await this.getContentLink(group)

    return `${this.relations.user.get('name')} flagged a ${this.get('object_type')} in ${group ? group.get('name') : 'Public'} for being ${this.get('category')}\n` +
      `Message: ${this.get('reason')}\n` +
      `${link}\n\n`
  },

  async getContentLink (group) {
    switch (this.get('object_type')) {
      case FlaggedItem.Type.POST: {
        const post = await this.getObject()
        return Frontend.Route.post(post, group)
      }
      case FlaggedItem.Type.COMMENT: {
        const comment = await this.getObject()
        return Frontend.Route.comment({ comment, group })
      }
      case FlaggedItem.Type.MEMBER:
        return Frontend.Route.profile(this.get('object_id'), group)
      default:
        throw new GraphQLError('Unsupported type for Flagged Item: ' + this.get('object_type'))
    }
  }

}, {
  Category: {
    INAPPROPRIATE: 'inappropriate',
    OFFENSIVE: 'offensive',
    ABUSIVE: 'abusive',
    ILLEGAL: 'illegal',
    OTHER: 'other',
    SAFETY: 'safety',
    SPAM: 'spam'
  },

  Type: {
    POST: 'post',
    COMMENT: 'comment',
    MEMBER: 'member'
  },

  find (id, opts = {}) {
    return FlaggedItem.where({ id })
      .fetch(opts)
  },

  create: function (attrs) {
    const { category, link } = attrs

    let { reason } = attrs

    if (!values(this.Category).find(c => category === c)) {
      return Promise.reject(new GraphQLError('Unknown category.'))
    }

    // set reason to 'N/A' if not required (!other) and it's empty.
    if (category !== 'other' && isEmpty(trim(reason))) {
      reason = 'N/A'
    }

    const invalidReason = Validators.validateFlaggedItem.reason(reason)
    if (invalidReason) return Promise.reject(new GraphQLError(invalidReason))

    if (process.env.NODE_ENV !== 'development') {
      const invalidLink = Validators.validateFlaggedItem.link(link)
      if (invalidLink) return Promise.reject(new GraphQLError(invalidLink))
    }

    return this.forge(attrs).save()
  },

  async notifyModerators ({ id }) {
    const flaggedItem = await FlaggedItem.find(id, { withRelated: 'user' })
    switch (flaggedItem.get('object_type')) {
      case FlaggedItem.Type.POST:
        return notifyModeratorsPost(flaggedItem)
      case FlaggedItem.Type.COMMENT:
        return notifyModeratorsComment(flaggedItem)
      case FlaggedItem.Type.MEMBER:
        return notifyModeratorsMember(flaggedItem)
      default:
        throw new GraphQLError('Unsupported type for Flagged Item: ' + flaggedItem.get('object_type'))
    }
  }
})
