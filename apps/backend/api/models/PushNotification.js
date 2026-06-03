import decode from 'ent/decode'
import { TextHelpers } from '@hylo/shared'
import { getLocaleStrings } from '../../lib/i18n/locales'

module.exports = bookshelf.Model.extend({
  tableName: 'push_notifications',
  requireFetch: false,

  user: function () {
    return this.belongsTo(User)
  },

  send: async function (options) {
    const alert = this.get('alert')
    const path = this.get('path')
    const badgeNo = this.get('badge_no')
    const user = await User.find(this.get('user_id'))

    if (!user) {
      // If no user, mark as disabled and return
      await this.save({ sent_at: new Date().toISOString(), disabled: true }, options)
      return this
    }

    const readerId = user.id
    let disabled = false

    if (process.env.PUSH_NOTIFICATIONS_ENABLED !== 'true') {
      const isTester = await User.isTester(user.id)
      disabled = process.env.PUSH_NOTIFICATIONS_TESTING_ENABLED !== 'true' || !isTester
    }

    await this.save({ sent_at: new Date().toISOString(), disabled }, options)
    if (!disabled) {
      await OneSignal.notify({
        readerId, alert, path, badgeNo
      })
    }
    return this
  },

  getPlatform: function () {
    const platform = this.get('platform')
    if (platform) {
      return platform
    } else {
      return 'ios_macos'
    }
  }

}, {
  textForContribution: function (contribution, locale) {
    const post = contribution.relations.post

    return getLocaleStrings(locale).textForContribution(post)
  },

  textForComment: function (comment, version, locale = 'en') {
    const person = comment.relations.user.get('name')
    const { media } = comment.relations
    if (media && media.length !== 0) {
      // return `${person} sent an image` // Question: do we want to start adding more text detail here?
      return getLocaleStrings(locale).textForCommentImage(person)
    }
    const blurb = TextHelpers.presentHTMLToText(comment.text(), { truncate: 140 })
    const postName = comment.relations.post.summary()

    return version === 'mention'
      ? getLocaleStrings(locale).textForCommentMention({ person, blurb, postName })
      : getLocaleStrings(locale).textForComment({ person, blurb, postName })
  },

  textForPost: function (post, group, firstTag, version, locale) {
    const person = post.relations.user.get('name')
    const postName = decode(post.summary())
    const groupName = group.get('name')

    switch (version) {
      case 'chat':
        return getLocaleStrings(locale).textForChatPost({ groupName, person, postName })
      case 'mention':
        return getLocaleStrings(locale).textForPostMention({ groupName, person, postName })
      case 'voteReset':
        return getLocaleStrings(locale).textForVoteReset({ person, postName, groupName })
      default:
        return getLocaleStrings(locale).textForPost({ person, postName, groupName, firstTag })
    }
  },

  textForAnnouncement: function (post, group, locale) {
    const person = post.relations.user.get('name')
    const postName = decode(post.summary())
    const groupName = group.get('name')

    return getLocaleStrings(locale).textForAnnouncement({ groupName, person, postName })
  },

  textForEventInvitation: function (post, actor, locale) {
    const postName = decode(post.summary())

    return getLocaleStrings(locale).textForEventInvitation({ actor, postName })
  },

  textForJoinRequest: function (group, actor, locale) {
    return getLocaleStrings(locale).textForJoinRequest({ actor, groupName: group.get('name') })
  },

  textForApprovedJoinRequest: function (group, actor, locale) {
    return getLocaleStrings(locale).textForApprovedJoinRequest({ actor, groupName: group.get('name') })
  },

  textForGroupChildGroupInvite: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupChildGroupInvite({ actor, parentGroup, childGroup })
  },

  textForGroupChildGroupInviteAcceptedParentModerator: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupChildGroupInviteAcceptedParentModerator({ actor, parentGroup, childGroup })
  },

  textForGroupChildGroupInviteAcceptedParentMember: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupChildGroupInviteAcceptedParentMember({ parentGroup, childGroup })
  },

  textForGroupChildGroupInviteAcceptedChildModerator: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupChildGroupInviteAcceptedChildModerator({ parentGroup, childGroup })
  },

  textForGroupChildGroupInviteAcceptedChildMember: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupChildGroupInviteAcceptedChildMember({ parentGroup, childGroup })
  },

  textForGroupParentGroupJoinRequest: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupParentGroupJoinRequest({ actor, parentGroup, childGroup })
  },

  textForGroupParentGroupJoinRequestAcceptedParentModerator: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupParentGroupJoinRequestAcceptedParentModerator({ parentGroup, childGroup, actor })
  },

  textForGroupParentGroupJoinRequestAcceptedParentMember: function (parentGroup, childGroup, locale) {
    return getLocaleStrings(locale).textForGroupParentGroupJoinRequestAcceptedParentMember({ parentGroup, childGroup })
  },

  textForGroupParentGroupJoinRequestAcceptedChildModerator: function (parentGroup, childGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupParentGroupJoinRequestAcceptedChildModerator({ parentGroup, childGroup, actor })
  },

  textForGroupParentGroupJoinRequestAcceptedChildMember: function (parentGroup, childGroup, locale) {
    return getLocaleStrings(locale).textForGroupParentGroupJoinRequestAcceptedChildMember({ parentGroup, childGroup })
  },

  textForGroupPeerGroupInvite: function (fromGroup, toGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupPeerGroupInvite({ actor, fromGroup, toGroup })
  },

  textForGroupPeerGroupInviteAccepted: function (fromGroup, toGroup, actor, locale) {
    return getLocaleStrings(locale).textForGroupPeerGroupInviteAccepted({ actor, fromGroup, toGroup })
  },

  textForDonationTo: function (contribution, locale) {
    const project = contribution.relations.project
    const postName = decode(project.summary())
    const amount = contribution.get('amount') / 100

    return getLocaleStrings(locale).textForDonationTo({ postName, amount })
  },

  textForDonationFrom: function (contribution, locale) {
    const actor = contribution.relations.user
    const project = contribution.relations.project
    const postName = decode(project.summary())

    const amount = contribution.get('amount') / 100
    return getLocaleStrings(locale).textForDonationFrom({ actor, postName, amount })
  },

  textForMemberJoinedGroup: function (group, actor, locale) {
    return getLocaleStrings(locale).textForMemberJoinedGroup({ group, actor })
  },

  textForTrackCompleted: function (track, actor, locale) {
    return getLocaleStrings(locale).textForTrackCompleted({ actor, track })
  },

  textForTrackEnrollment: function (track, actor, locale) {
    return getLocaleStrings(locale).textForTrackEnrollment({ actor, track })
  },

  textForFundingRoundNewSubmission: function (fundingRound, post, actor, locale) {
    return getLocaleStrings(locale).textForFundingRoundNewSubmission({ fundingRound, post, actor })
  },

  textForFundingRoundPhaseTransition: function (fundingRound, phase, locale) {
    return getLocaleStrings(locale).textForFundingRoundPhaseTransition({ fundingRound, phase })
  },

  textForFundingRoundReminder: function (fundingRound, reminderType, locale) {
    return fundingRound.get('title') + ': ' + getLocaleStrings(locale).textForFundingRoundReminder({ reminderType })
  }
})
