/* eslint-disable camelcase */
import { sendMessageFromAxolotl } from '../services/MessagingService'

import { pick } from 'lodash/fp'
import { es } from '../../lib/i18n/es'
import { en } from '../../lib/i18n/en'

const locales = { es, en }

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

  reporter: function () {
    return this.belongsTo(User, 'reporter_id')
  },

  async getMessageText ({ group, groupId, anonymous }) {
    const link = await Frontend.Route.post(this.get('post_id'), group)
    if (groupId === group.id) {
      const agreements = this.relations.agreements.models.concat(this.relations.platformAgreements.models)

      return `${this.relations.reporter.get('name')} flagged a post in ${group.get('name')}\n` +
        `Message: ${this.get('text')}\n` +
        `Broken agreements: ${agreements.map(agreement => agreement.get('title') || agreement.get('text')).join(', ')}\n` +
        `${link}\n\n`
    } else {
      const agreements = this.relations.platformAgreements.models

      return `${anonymous ? 'Anonymous reporter' : this.relations.reporter.get('name')} flagged a post in another group: ${group.get('name')}\n` +
        `Message: ${this.get('text')}\n` +
        `Broken agreements: ${agreements.map(agreement => agreement.get('text')).join(', ')}\n` +
        `${link}\n\n`
    }
  }
}, {
  create: async function (data, opts) {
    const { agreements, anonymous, platformAgreements, postId, groupId, reporterId, text } = data

    const modAction = await ModerationAction.forge({ anonymous, post_id: postId, reporter_id: reporterId, text, status: 'active', group_id: groupId })
      .save(null, pick(opts, 'transacting'))
    await modAction.platformAgreements().attach(platformAgreements)
    await modAction.agreements().attach(agreements)
    await Post.addToFlaggedGroups({ postId, groupId })
    return modAction
  },

  clearAction: async function ({ postId, groupId, moderationActionId }) {
    let action
    try {
      action = await ModerationAction.where({ id: moderationActionId }).fetch()
      await action.save({ status: 'cleared' }, { patch: true })
    } catch (error) {
      throw new Error('Moderation action not found')
    }
    await Post.removeFromFlaggedGroups({ postId, groupId })
    return action
  },

  async sendEmailsForModerationAction ({ reporterId, postId, groupId, type = 'created' }) {
    // type is 'created' or 'cleared'
    // email reportee and reporter
    const group = await Group.find(groupId)
    const reporter = await User.find(reporterId)
    const post = await Post.find(postId, { withRelated: ['user'] })
    const reportee = post.relations.user
    const link = await Frontend.Route.post(postId, group)
    const reporterLocale = reporter.getLocale()
    const reporteeLocale = reportee.getLocale()

    const reporterSubject = type === 'created'
      ? locales[reporterLocale].moderationYouFlaggedAPost()
      : locales[reporterLocale].moderationClearedYourFlag()

    const reporterMessageContent = type === 'created'
      ? `${locales[reporterLocale].moderationYouFlaggedPostEmailContent({ post, group })}`
      : `${locales[reporterLocale].moderationReporterClearedPostEmailContent({ post, group })}`

    const reporteeSubject = type === 'created'
      ? locales[reporteeLocale].moderationYourPostWasFlagged()
      : locales[reporteeLocale].moderationClearedFlagFromYourPost()

    const reporteeMessageContent = type === 'created'
      ? `${locales[reporteeLocale].moderationFlaggedPostEmailContent({ post, group })}`
      : `${locales[reporteeLocale].moderationClearedPostEmailContent({ post, group })}`

    Queue.classMethod('Email', 'sendModerationAction', {
      email: reporter.get('email'),
      templateData: {
        subject: reporterSubject,
        body: reporterMessageContent +
        `${link}\n\n`
      },
      locale: reporterLocale
    })

    Queue.classMethod('Email', 'sendModerationAction', {
      email: reportee.get('email'),
      templateData: {
        subject: reporteeSubject,
        body: reporteeMessageContent +
        `${link}\n\n`
      },
      local: reporteeLocale
    })
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
