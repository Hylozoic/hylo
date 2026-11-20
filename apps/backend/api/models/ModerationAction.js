/* eslint-disable camelcase */
import { sendMessageFromAxolotl } from '../services/MessagingService'

import { pick } from 'lodash/fp'
import { TextHelpers } from '@hylo/shared'
import { getLocaleStrings } from '../../lib/i18n/locales'

// Where a report goes: the group's moderation queue, or Hylo staff
const QUEUE_GROUP = 'group'
const QUEUE_STAFF = 'staff'

function commentSummary (comment) {
  return TextHelpers.presentHTMLToText(comment.text(), { truncate: 80 })
}

module.exports = bookshelf.Model.extend({
  tableName: 'moderation_actions',
  requireFetch: false,
  hasTimestamps: true,

  agreements: function () {
    return this.belongsToMany(Agreement, 'moderation_actions_agreements', 'moderation_action_id', 'agreement_id')
  },

  group: function () {
    return this.belongsTo(Group, 'group_id')
  },

  groupId: function () {
    return this.get('group_id')
  },

  anonymous: function () {
    return this.get('anonymous')
  },

  platformAgreements: function () {
    return this.belongsToMany(PlatformAgreement, 'moderation_actions_platform_agreements', 'moderation_action_id', 'platform_agreement_id')
  },

  post: function () {
    return this.belongsTo(Post, 'post_id')
  },

  // The comment, for a report about one comment (post_id is then the comment's post)
  comment: function () {
    return this.belongsTo(Comment, 'comment_id')
  },

  // The person a staff report is about
  reportedUser: function () {
    return this.belongsTo(User, 'reported_user_id')
  },

  // Everyone who has been in the reported conversation, including anyone who left it
  threadParticipants: function () {
    const threadId = this.get('message_thread_id')
    if (!threadId) return Promise.resolve([])
    return User.query(q => {
      q.join('posts_users', 'posts_users.user_id', 'users.id')
      q.where('posts_users.post_id', threadId)
      q.orderBy('users.id')
    }).fetchAll()
  },

  resolvedBy: function () {
    return this.belongsTo(User, 'resolved_by_id')
  },

  isCommentReport: function () {
    return !!this.get('comment_id')
  },

  reporter: function () {
    return this.belongsTo(User, 'reporter_id')
  },

  async getMessageText ({ group, groupId, anonymous }) {
    const post = await this.post().fetch({ withRelated: ['tags'] })
    const comment = this.isCommentReport() ? await this.comment().fetch({ withRelated: ['post'] }) : null
    const link = comment
      ? await Frontend.Route.comment({ comment, group, post })
      : await Frontend.Route.post(post, group)
    const noun = comment ? 'comment' : 'post'
    if (groupId === group.id) {
      const agreements = this.relations.agreements.models.concat(this.relations.platformAgreements.models)

      return `${this.relations.reporter.get('name')} flagged a ${noun} in ${group.get('name')}\n` +
        `Message: ${this.get('text')}\n` +
        `Broken agreements: ${agreements.map(agreement => agreement.get('title') || agreement.get('text')).join(', ')}\n` +
        `${link}\n\n`
    } else {
      const agreements = this.relations.platformAgreements.models

      return `${anonymous ? 'Anonymous reporter' : this.relations.reporter.get('name')} flagged a ${noun} in another group: ${group.get('name')}\n` +
        `Message: ${this.get('text')}\n` +
        `Broken agreements: ${agreements.map(agreement => agreement.get('text')).join(', ')}\n` +
        `${link}\n\n`
    }
  }
}, {
  QUEUE_GROUP,
  QUEUE_STAFF,

  // Reasons a person can pick when reporting to Hylo staff
  STAFF_CATEGORIES: ['inappropriate', 'spam', 'offensive', 'abusive', 'illegal', 'safety', 'other'],

  create: async function (data, opts) {
    const { agreements, anonymous, commentId, platformAgreements, postId, groupId, reporterId, text } = data

    const modAction = await ModerationAction.forge({
      anonymous,
      post_id: postId,
      comment_id: commentId || null,
      reporter_id: reporterId,
      text,
      status: 'active',
      group_id: groupId,
      queue: QUEUE_GROUP
    })
      .save(null, pick(opts, 'transacting'))
    await modAction.platformAgreements().attach(platformAgreements)
    await modAction.agreements().attach(agreements)
    // A comment report goes to the queue without flagging the whole post
    if (!commentId) await Post.addToFlaggedGroups({ postId, groupId })
    return modAction
  },

  /**
   * A report to Hylo staff about a person or a direct message conversation.
   * It never reaches a group's moderation queue.
   */
  createStaffReport: async function ({ reporterId, reportedUserId, messageThreadId, category, text }) {
    return ModerationAction.forge({
      reporter_id: reporterId,
      reported_user_id: reportedUserId || null,
      message_thread_id: messageThreadId || null,
      category,
      text,
      status: 'active',
      anonymous: 'false',
      queue: QUEUE_STAFF
    }).save()
  },

  resolveStaffReport: async function ({ id, userId }) {
    const report = await ModerationAction.where({ id, queue: QUEUE_STAFF }).fetch()
    if (!report) throw new Error('Report not found')
    return report.save({ status: 'resolved', resolved_by_id: userId, resolved_at: new Date() }, { patch: true })
  },

  clearAction: async function ({ postId, groupId, moderationActionId }) {
    let action
    try {
      action = await ModerationAction.where({ id: moderationActionId, queue: QUEUE_GROUP }).fetch()
      await action.save({ status: 'cleared' }, { patch: true })
    } catch (error) {
      throw new Error('Moderation action not found')
    }
    if (!action.isCommentReport()) await Post.removeFromFlaggedGroups({ postId, groupId })
    return action
  },

  async sendEmailsForModerationAction ({ reporterId, postId, commentId, groupId, type = 'created' }) {
    // type is 'created' or 'cleared'
    // email reportee and reporter
    const group = await Group.find(groupId)
    const reporter = await User.find(reporterId)
    const post = await Post.find(postId, { withRelated: ['user', 'tags'] })
    const comment = commentId ? await Comment.find(commentId, { withRelated: ['user', 'post'] }) : null
    const reportee = comment ? comment.relations.user : post.relations.user
    const link = comment
      ? await Frontend.Route.comment({ comment, group, post })
      : await Frontend.Route.post(post, group)
    const reporterLocale = reporter.getLocale()
    const reporteeLocale = reportee.getLocale()

    const reporterL = getLocaleStrings(reporterLocale)
    const reporteeL = getLocaleStrings(reporteeLocale)
    const summary = comment ? commentSummary(comment) : null
    let reporterSubject, reporterMessageContent, reporteeSubject, reporteeMessageContent

    if (comment) {
      reporterSubject = type === 'created'
        ? reporterL.moderationYouFlaggedAComment()
        : reporterL.moderationClearedYourFlag()
      reporterMessageContent = type === 'created'
        ? reporterL.moderationYouFlaggedCommentEmailContent({ summary, group })
        : reporterL.moderationReporterClearedCommentEmailContent({ summary, group })
      reporteeSubject = type === 'created'
        ? reporteeL.moderationYourCommentWasFlagged()
        : reporteeL.moderationClearedFlagFromYourComment()
      reporteeMessageContent = type === 'created'
        ? reporteeL.moderationFlaggedCommentEmailContent({ summary, group })
        : reporteeL.moderationClearedCommentEmailContent({ summary, group })
    } else {
      reporterSubject = type === 'created'
        ? reporterL.moderationYouFlaggedAPost()
        : reporterL.moderationClearedYourFlag()
      reporterMessageContent = type === 'created'
        ? `${reporterL.moderationYouFlaggedPostEmailContent({ post, group })}`
        : `${reporterL.moderationReporterClearedPostEmailContent({ post, group })}`
      reporteeSubject = type === 'created'
        ? reporteeL.moderationYourPostWasFlagged()
        : reporteeL.moderationClearedFlagFromYourPost()
      reporteeMessageContent = type === 'created'
        ? `${reporteeL.moderationFlaggedPostEmailContent({ post, group })}`
        : `${reporteeL.moderationClearedPostEmailContent({ post, group })}`
    }

    const emailsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true'

    if (emailsEnabled || (await User.isTester(reporter.id))) {
      Queue.classMethod('Email', 'sendModerationAction', {
        email: reporter.get('email'),
        templateData: {
          subject: reporterSubject,
          body: reporterMessageContent +
          `${link}\n\n`,
          post_url: link
        },
        locale: reporterLocale
      })
    }

    if (emailsEnabled || (await User.isTester(reportee.id))) {
      Queue.classMethod('Email', 'sendModerationAction', {
        email: reportee.get('email'),
        templateData: {
          subject: reporteeSubject,
          body: reporteeMessageContent +
          `${link}\n\n`
        },
        locale: reporteeLocale
      })
    }
  },

  async sendToModerators ({ moderationActionId, postId, groupId, anonymous }) {
    const moderationAction = await ModerationAction.where({ id: moderationActionId }).fetch({ withRelated: ['agreements', 'platformAgreements', 'reporter'] })
    const post = await Post.find(postId)
    const groups = await post.groups().fetch()

    const send = async (group, userIds, anonymous) => {
      const text = await moderationAction.getMessageText({ group, groupId, anonymous })
      return sendMessageFromAxolotl(userIds, text)
    }
    for (const group of groups) {
      const moderators = await group.moderators().fetch()
      await send(group, moderators.map(moderator => moderator.id), anonymous)
    }
    const shouldSendToAdmins = (post.isPublic() && process.env.HYLO_ADMINS &&
      moderationAction.relationships.platformAgreements &&
      moderationAction.relationships.platformAgreements.length > 0)

    if (shouldSendToAdmins) {
      const adminIds = process.env.HYLO_ADMINS.split(',').map(id => Number(id))
      const group = groups.filter(g => g.id === groupId)
      await send(group, adminIds, anonymous = false)
    }
  }
})
