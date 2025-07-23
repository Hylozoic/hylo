import { isEmpty } from 'lodash'
import { get, includes } from 'lodash/fp'
import { refineOne } from './util/relations'
import rollbar from '../../lib/rollbar'
import { broadcast, userRoom } from '../services/Websockets'
import RedisPubSub from '../services/RedisPubSub'
import { en } from '../../lib/i18n/en'
import { es } from '../../lib/i18n/es'
const locales = { en, es }

const TYPE = {
  Mention: 'mention', // you are mentioned in a post or comment
  Chat: 'chat', // someone chats you in a chat room you subscribe to
  TagFollow: 'TagFollow',
  NewPost: 'newPost',
  Comment: 'comment', // someone makes a comment on a post you follow
  Contribution: 'contribution', // you are added as a contributor
  FollowAdd: 'followAdd', // you are added as a follower
  Follow: 'follow', // someone follows your post
  Unfollow: 'unfollow', // someone leaves your post
  Welcome: 'welcome', // a welcome post
  JoinRequest: 'joinRequest', // Someone asks to join a group
  ApprovedJoinRequest: 'approvedJoinRequest', // A request to join a group is approved
  GroupChildGroupInvite: 'groupChildGroupInvite', // A child group is invited to join a parent group
  GroupChildGroupInviteAccepted: 'groupChildGroupInviteAccepted',
  GroupParentGroupJoinRequest: 'groupParentGroupJoinRequest', // A child group is requesting to join a parent group
  GroupParentGroupJoinRequestAccepted: 'groupParentGroupJoinRequestAccepted',
  Message: 'message',
  Announcement: 'announcement',
  DonationTo: 'donation to',
  DonationFrom: 'donation from',
  TrackCompleted: 'trackCompleted',
  TrackEnrollment: 'trackEnrollment'
}

const MEDIUM = {
  InApp: 0,
  Push: 1,
  Email: 2
}

module.exports = bookshelf.Model.extend({
  tableName: 'notifications',
  requireFetch: false,
  hasTimestamps: true,

  activity: function () {
    return this.belongsTo(Activity)
  },

  post: function () {
    return this.related('activity').related('post')
  },

  comment: function () {
    return this.related('activity').related('comment')
  },

  reader: function () {
    return this.related('activity').related('reader')
  },

  actor: function () {
    return this.related('activity').related('actor')
  },

  projectContribution: function () {
    return this.relations.activity.relations.projectContribution
  },

  locale: function () {
    return this.reader().get('settings')?.locale || this.actor().getLocale()
  },

  track: function () {
    return this.related('activity').related('track')
  },

  send: async function () {
    if (await this.shouldBeBlocked()) {
      this.destroy()
      return
    }
    const userId = this.reader().id
    switch (this.get('medium')) {
      case MEDIUM.Push:
        if (process.env.PUSH_NOTIFICATIONS_ENABLED === 'true' || User.isTester(userId)) {
          await this.sendPush()
        }
        break
      case MEDIUM.Email:
        if (process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true' || User.isTester(userId)) {
          await this.sendEmail()
        }
        break
      case MEDIUM.InApp: {
        await User.incNewNotificationCount(userId)
        await this.updateUserSocketRoom(userId)
        break
      }
    }
    this.save({ sent_at: (new Date()).toISOString() })
    return Promise.resolve()
  },

  sendPush: async function () {
    switch (Notification.priorityReason(this.relations.activity.get('meta').reasons)) {
      case 'announcement':
        return this.sendAnnouncementPush()
      case 'approvedJoinRequest':
        return this.sendApprovedJoinRequestPush()
      case 'commentMention':
        return this.sendCommentPush('mention')
      case 'donation to':
        return this.sendPushDonationTo()
      case 'donation from':
        return this.sendPushDonationFrom()
      case 'eventInvitation':
        return this.sendEventInvitationPush()
      case 'groupChildGroupInvite':
        return this.sendGroupChildGroupInvitePush()
      case 'groupChildGroupInviteAccepted':
        return this.sendGroupChildGroupInviteAcceptedPush()
      case 'groupParentGroupJoinRequest':
        return this.sendGroupParentGroupJoinRequestPush()
      case 'groupParentGroupJoinRequestAccepted':
        return this.sendGroupParentGroupJoinRequestAcceptedPush()
      case 'joinRequest':
        return this.sendJoinRequestPush()
      case 'memberJoinedGroup':
        return this.sendMemberJoinedGroupPush()
      case 'mention':
        return this.sendPostPush('mention')
      case 'newComment':
        return this.sendCommentPush()
      case 'newContribution':
        return this.sendContributionPush()
      case 'newPost':
      case 'tag':
        return this.sendPostPush()
      case 'chat':
        return this.sendPostPush('chat')
      case 'trackCompleted':
        return this.sendTrackCompletedPush()
      case 'trackEnrollment':
        return this.sendTrackEnrollmentPush()
      case 'voteReset':
        return this.sendPostPush('voteReset')
      default:
        return Promise.resolve()
    }
  },

  sendApprovedJoinRequestPush: function () {
    const groupIds = Activity.groupIds(this.relations.activity)
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const locale = this.locale()
    return Group.find(groupIds[0])
      .then(group => {
        const path = new URL(Frontend.Route.group(group)).pathname
        const alertText = PushNotification.textForApprovedJoinRequest(group, this.actor(), locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendAnnouncementPush: function (version) {
    const post = this.post()
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    return Group.find(groupIds[0])
      .then(group => {
        const path = new URL(Frontend.Route.post(post, group)).pathname
        const alertText = PushNotification.textForAnnouncement(post, group, locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendContributionPush: function (version) {
    const locale = this.locale()
    return this.load(['contribution', 'contribution.post'])
      .then(() => {
        const { contribution } = this.relations.activity.relations
        const path = new URL(Frontend.Route.post(contribution.relations.post)).pathname
        const alertText = PushNotification.textForContribution(contribution, version, locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendTrackCompletedPush: async function () {
    const track = this.track()
    const locale = this.locale()
    const path = new URL(Frontend.Route.track(track)).pathname
    const alertText = PushNotification.textForTrackCompleted(track, this.actor(), locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendTrackEnrollmentPush: async function () {
    const track = this.track()
    const locale = this.locale()
    const path = new URL(Frontend.Route.track(track)).pathname
    const alertText = PushNotification.textForTrackEnrollment(track, this.actor(), locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendEventInvitationPush: function () {
    const post = this.post()
    const actor = this.actor()
    const locale = this.locale()
    const groupIds = Activity.groupIds(this.relations.activity)
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    return Group.find(groupIds[0])
      .then(group => {
        const path = new URL(Frontend.Route.post(post, group)).pathname
        const alertText = PushNotification.textForEventInvitation(post, actor, locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendPostPush: async function (version) {
    const post = this.post()
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()
    const tags = post.relations.tags
    const firstTag = tags && tags.first()?.get('name')
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    // TODO: include all groups in the notification?
    return Group.find(groupIds[0])
      .then(group => {
        const path = new URL(Frontend.Route.post(post, group)).pathname
        const alertText = PushNotification.textForPost(post, group, firstTag, version, locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendCommentPush: function (version) {
    const comment = this.comment()
    const post = comment.relations.post
    const group = post.relations.groups.first()
    const locale = this.locale()
    const path = new URL(Frontend.Route.comment({ comment, group, post })).pathname
    const alertText = PushNotification.textForComment(comment, version, locale)
    if (!this.reader().enabledNotification(TYPE.Comment, MEDIUM.Push)) {
      return Promise.resolve()
    }
    return this.reader().sendPushNotification(alertText, path)
  },

  sendJoinRequestPush: function () {
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    return Group.find(groupIds[0])
      .then(group => {
        const path = new URL(Frontend.Route.groupJoinRequests(group)).pathname
        const alertText = PushNotification.textForJoinRequest(group, this.actor(), locale)
        return this.reader().sendPushNotification(alertText, path)
      })
  },

  sendGroupChildGroupInvitePush: async function () {
    const childGroup = await this.relations.activity.otherGroup().fetch()
    const parentGroup = await this.relations.activity.group().fetch()
    const locale = this.locale()
    if (!childGroup || !parentGroup) throw new Error('Missing a group in activity')
    const path = new URL(Frontend.Route.groupRelationshipInvites(childGroup)).pathname
    const alertText = PushNotification.textForGroupChildGroupInvite(parentGroup, childGroup, this.actor(), locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendGroupChildGroupInviteAcceptedPush: async function () {
    const childGroup = await this.relations.activity.group().fetch()
    const parentGroup = await this.relations.activity.otherGroup().fetch()
    const locale = this.locale()
    if (!childGroup || !parentGroup) throw new Error('Missing a group in activity')
    const reason = this.relations.activity.get('meta').reasons[0]
    const whichGroup = reason.split(':')[1]
    const groupMemberType = reason.split(':')[2]
    let alertPath, alertText
    if (whichGroup === 'parent' && groupMemberType === 'moderator') {
      alertPath = new URL(Frontend.Route.group(childGroup)).pathname
      alertText = PushNotification.textForGroupChildGroupInviteAcceptedParentModerator(parentGroup, childGroup, this.actor(), locale)
    } else if (whichGroup === 'parent' && groupMemberType === 'member') {
      alertPath = new URL(Frontend.Route.group(childGroup)).pathname
      alertText = PushNotification.textForGroupChildGroupInviteAcceptedParentMember(parentGroup, childGroup, this.actor(), locale)
    } else if (whichGroup === 'child' && groupMemberType === 'moderator') {
      alertPath = new URL(Frontend.Route.group(parentGroup)).pathname
      alertText = PushNotification.textForGroupChildGroupInviteAcceptedChildModerator(parentGroup, childGroup, this.actor(), locale)
    } else if (whichGroup === 'child' && groupMemberType === 'member') {
      alertPath = new URL(Frontend.Route.group(parentGroup)).pathname
      alertText = PushNotification.textForGroupChildGroupInviteAcceptedChildMember(parentGroup, childGroup, this.actor(), locale)
    }
    return this.reader().sendPushNotification(alertText, alertPath)
  },

  sendGroupParentGroupJoinRequestPush: async function () {
    const parentGroup = await this.relations.activity.otherGroup().fetch()
    const childGroup = await this.relations.activity.group().fetch()
    const locale = this.locale()
    if (!childGroup || !parentGroup) throw new Error('Missing a group in activity')
    const path = new URL(Frontend.Route.groupRelationshipJoinRequests(parentGroup)).pathname
    const alertText = PushNotification.textForGroupParentGroupJoinRequest(parentGroup, childGroup, this.actor(), locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendGroupParentGroupJoinRequestAcceptedPush: async function () {
    const parentGroup = await this.relations.activity.otherGroup().fetch()
    const childGroup = await this.relations.activity.group().fetch()
    const locale = this.locale()
    if (!childGroup || !parentGroup) throw new Error('Missing a group in activity')
    const reason = this.relations.activity.get('meta').reasons[0]
    const whichGroup = reason.split(':')[1]
    const groupMemberType = reason.split(':')[2]
    let alertPath, alertText
    if (whichGroup === 'parent' && groupMemberType === 'moderator') {
      alertPath = new URL(Frontend.Route.group(childGroup)).pathname
      alertText = PushNotification.textForGroupParentGroupJoinRequestAcceptedParentModerator(parentGroup, childGroup, this.actor(), locale)
    } else if (whichGroup === 'parent' && groupMemberType === 'member') {
      alertPath = new URL(Frontend.Route.group(childGroup)).pathname
      alertText = PushNotification.textForGroupParentGroupJoinRequestAcceptedParentMember(parentGroup, childGroup, locale)
    } else if (whichGroup === 'child' && groupMemberType === 'moderator') {
      alertPath = new URL(Frontend.Route.group(parentGroup)).pathname
      alertText = PushNotification.textForGroupParentGroupJoinRequestAcceptedChildModerator(parentGroup, childGroup, this.actor(), locale)
    } else if (whichGroup === 'child' && groupMemberType === 'member') {
      alertPath = new URL(Frontend.Route.group(parentGroup)).pathname
      alertText = PushNotification.textForGroupParentGroupJoinRequestAcceptedChildMember(parentGroup, childGroup, locale)
    }
    return this.reader().sendPushNotification(alertText, alertPath)
  },

  sendPushDonationTo: async function () {
    await this.load(['activity.projectContribution', 'activity.projectContribution.project', 'activity.projectContribution.user'])
    const projectContribution = this.projectContribution()
    const locale = this.locale()
    const path = new URL(Frontend.Route.post(projectContribution.relations.project)).pathname
    const alertText = PushNotification.textForDonationTo(projectContribution, locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendPushDonationFrom: async function () {
    await this.load(['activity.projectContribution', 'activity.projectContribution.project', 'activity.projectContribution.user'])
    const projectContribution = this.projectContribution()
    const locale = this.locale()
    const path = new URL(Frontend.Route.post(projectContribution.relations.project)).pathname
    const alertText = PushNotification.textForDonationFrom(projectContribution, locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendMemberJoinedGroupPush: async function () {
    const group = await this.relations.activity.group().fetch()
    const actor = await this.relations.activity.actor().fetch()
    const locale = this.locale()
    const path = new URL(Frontend.Route.profile(actor, group)).pathname
    const alertText = PushNotification.textForMemberJoinedGroup(group, actor, locale)
    return this.reader().sendPushNotification(alertText, path)
  },

  sendEmail: async function () {
    switch (Notification.priorityReason(this.relations.activity.get('meta').reasons)) {
      case 'announcement':
        return this.sendAnnouncementEmail()
      case 'approvedJoinRequest':
        return this.sendApprovedJoinRequestEmail()
      case 'donation to':
        return this.sendDonationToEmail()
      case 'donation from':
        return this.sendDonationFromEmail()
      case 'eventInvitation':
        return this.sendEventInvitationEmail()
      case 'groupChildGroupInvite':
        return this.sendGroupChildGroupInviteEmail()
      case 'groupChildGroupInviteAccepted':
        return this.sendGroupChildGroupInviteAcceptedEmail()
      case 'groupParentGroupJoinRequest':
        return this.sendGroupParentGroupJoinRequestEmail()
      case 'groupParentGroupJoinRequestAccepted':
        return this.sendGroupParentGroupJoinRequestAcceptedEmail()
      case 'joinRequest':
        return this.sendJoinRequestEmail()
      case 'memberJoinedGroup':
        return this.sendMemberJoinedGroupEmail()
      case 'mention':
        return this.sendPostMentionEmail()
      case 'newPost':
      case 'tag':
        return this.sendPostEmail()
      case 'trackCompleted':
        return this.sendTrackCompletedEmail()
      case 'trackEnrollment':
        return this.sendTrackEnrollmentEmail()
      default:
        return Promise.resolve()
    }
  },

  sendAnnouncementEmail: async function () {
    const post = this.post()
    const reader = this.reader()
    const user = post.relations.user
    const replyTo = Email.postReplyAddress(post.id, reader.id)
    const locale = this.locale()

    const groupIds = Activity.groupIds(this.relations.activity)
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'announcement_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendPostNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: {
        address: replyTo,
        reply_to: replyTo,
        name: `${user.get('name')} (via Hylo)`
      },
      data: {
        announcement: true,
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_name: group.get('name'),
        post: post.presentForEmail({ group, clickthroughParams, locale }),
        tracking_pixel_url: Analytics.pixelUrl('Announcement', { userId: reader.id })
      }
    })
  },

  sendPostEmail: async function () {
    const post = this.post()
    const reader = this.reader()
    const user = post.relations.user
    const replyTo = Email.postReplyAddress(post.id, reader.id)

    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()

    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'post_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendPostNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: {
        address: replyTo,
        reply_to: replyTo,
        name: `${user.get('name')} (via Hylo)`
      },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_name: group.get('name'),
        post: post.presentForEmail({ group, clickthroughParams, locale }),
        tracking_pixel_url: Analytics.pixelUrl('Post', { userId: reader.id })
      }
    })
  },

  sendPostMentionEmail: async function () {
    const post = this.post()
    const reader = this.reader()
    const user = post.relations.user
    const replyTo = Email.postReplyAddress(post.id, reader.id)
    const locale = this.locale()

    const groupIds = Activity.groupIds(this.relations.activity)
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'post_mention_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendPostMentionNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: {
        address: replyTo,
        reply_to: replyTo,
        name: `${user.get('name')} (via Hylo)`
      },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_name: group.get('name'),
        post: post.presentForEmail({ group, clickthroughParams, locale }),
        tracking_pixel_url: Analytics.pixelUrl('Mention in Post', { userId: reader.id })
      }
    })
  },

  sendJoinRequestEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()
    if (isEmpty(groupIds)) throw new Error('no group ids in activity')

    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'join_request_email',
      cti: reader.id,
      ctcn: group.get('name'),
      check_join_requests: 1
    }).toString()

    return Email.sendJoinRequestNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: group.get('name') },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_avatar_url: group.get('avatar_url'),
        group_name: group.get('name'),
        group_url: Frontend.Route.group(group) + clickthroughParams,
        join_question_answers: await GroupJoinQuestionAnswer.latestAnswersFor(group.id, actor.id),
        requester_name: actor.get('name'),
        requester_avatar_url: actor.get('avatar_url'),
        requester_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        settings_url: Frontend.Route.groupJoinRequests(group) + clickthroughParams
      }
    })
  },

  sendApprovedJoinRequestEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()

    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'approved_join_request_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendApprovedJoinRequestNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: group.get('name') },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_avatar_url: group.get('avatar_url'),
        group_name: group.get('name'),
        group_url: Frontend.Route.group(group) + clickthroughParams,
        approver_name: actor.get('name'),
        approver_avatar_url: actor.get('avatar_url'),
        approver_profile_url: Frontend.Route.profile(actor) + clickthroughParams
      }
    })
  },

  sendGroupChildGroupInviteEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const childGroup = await this.relations.activity.otherGroup().fetch()
    const parentGroup = await this.relations.activity.group().fetch()
    const locale = this.locale()

    if (!childGroup || !parentGroup) throw new Error('Missing group in activity')

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'group_child_group_invite_email',
      cti: reader.id
    }).toString()

    return Email.sendGroupChildGroupInviteNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: actor.get('name') + ' from ' + parentGroup.get('name') },
      data: {
        child_group_avatar_url: childGroup.get('avatar_url'),
        child_group_name: childGroup.get('name'),
        child_group_settings_url: Frontend.Route.groupRelationshipInvites(childGroup) + clickthroughParams,
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        inviter_avatar_url: actor.get('avatar_url'),
        inviter_name: actor.get('name'),
        inviter_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        parent_group_avatar_url: parentGroup.get('avatar_url'),
        parent_group_name: parentGroup.get('name'),
        parent_group_url: Frontend.Route.group(parentGroup) + clickthroughParams
      }
    })
  },

  sendGroupChildGroupInviteAcceptedEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const childGroup = await this.relations.activity.otherGroup().fetch()
    const parentGroup = await this.relations.activity.group().fetch()
    if (!childGroup || !parentGroup) throw new Error('Missing group in activity')
    const reason = this.relations.activity.get('meta').reasons[0]
    const memberOf = reason.split(':')[1]
    const memberType = reason.split(':')[2]
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'group_child_group_invite_accepted_email',
      cti: reader.id
    }).toString()

    return Email.sendGroupChildGroupInviteAcceptedNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: 'The Team at Hylo' },
      data: {
        accepter_avatar_url: actor.get('avatar_url'),
        accepter_name: actor.get('name'),
        accepter_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        child_group_avatar_url: childGroup.get('avatar_url'),
        child_group_name: childGroup.get('name'),
        child_group_url: Frontend.Route.group(childGroup) + clickthroughParams,
        child_group_accessibility: childGroup.get('accessibility'),
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        memberOf, // Is the receiver a member of the parent or child group?
        memberType, // 'member' or 'moderator' of the group they are a part of
        parent_group_accessibility: parentGroup.get('accessibility'),
        parent_group_avatar_url: parentGroup.get('avatar_url'),
        parent_group_name: parentGroup.get('name'),
        parent_group_url: Frontend.Route.groupRelationships(parentGroup) + clickthroughParams
      }
    })
  },

  sendGroupParentGroupJoinRequestEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const parentGroup = await this.relations.activity.otherGroup().fetch()
    const childGroup = await this.relations.activity.group().fetch()
    const locale = this.locale()

    if (!childGroup || !parentGroup) throw new Error('Missing group in activity')

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'group_parent_group_join_request_email',
      cti: reader.id
    }).toString()

    return Email.sendGroupParentGroupJoinRequestNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: actor.get('name') + ' from ' + childGroup.get('name') },
      data: {
        child_group_avatar_url: childGroup.get('avatar_url'),
        child_group_name: childGroup.get('name'),
        child_group_url: Frontend.Route.group(childGroup) + clickthroughParams,
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        parent_group_avatar_url: parentGroup.get('avatar_url'),
        parent_group_name: parentGroup.get('name'),
        parent_group_settings_url: Frontend.Route.groupRelationshipJoinRequests(parentGroup) + clickthroughParams,
        requester_avatar_url: actor.get('avatar_url'),
        requester_name: actor.get('name'),
        requester_profile_url: Frontend.Route.profile(actor) + clickthroughParams
      }
    })
  },

  sendGroupParentGroupJoinRequestAcceptedEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const childGroup = await this.relations.activity.group().fetch()
    const parentGroup = await this.relations.activity.otherGroup().fetch()
    if (!childGroup || !parentGroup) throw new Error('Missing group in activity')
    const reason = this.relations.activity.get('meta').reasons[0]
    const memberOf = reason.split(':')[1]
    const memberType = reason.split(':')[2]
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'group_parent_group_join_request_accepted_email',
      cti: reader.id
    }).toString()

    return Email.sendGroupParentGroupJoinRequestAcceptedNotification({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: { name: 'The Team at Hylo' },
      data: {
        accepter_avatar_url: actor.get('avatar_url'),
        accepter_name: actor.get('name'),
        accepter_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        child_group_accessibility: childGroup.get('accessibility'),
        child_group_avatar_url: childGroup.get('avatar_url'),
        child_group_name: childGroup.get('name'),
        child_group_url: Frontend.Route.group(childGroup) + clickthroughParams,
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        memberOf, // Is the receiver a member of the parent or child group?
        memberType, // 'member' or 'moderator' of the group they are a part of
        parent_group_accessibility: parentGroup.get('accessibility'),
        parent_group_avatar_url: parentGroup.get('avatar_url'),
        parent_group_name: parentGroup.get('name'),
        parent_group_url: Frontend.Route.groupRelationships(parentGroup) + clickthroughParams
      }
    })
  },

  sendDonationToEmail: async function () {
    await this.load(['activity.post', 'activity.projectContribution', 'activity.projectContribution.project', 'activity.projectContribution.user'])
    const projectContribution = this.projectContribution()
    const project = this.post()
    const actor = this.actor()
    const reader = this.reader()
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'donation_to_email',
      cti: reader.id
    }).toString()

    return Email.sendDonationToEmail({
      email: reader.get('email'),
      locale,
      sender: { name: project.summary() },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        project_title: project.summary(),
        project_url: Frontend.Route.post(project, null, clickthroughParams),
        contribution_amount: projectContribution.get('amount') / 100,
        contributor_name: actor.get('name'),
        contributor_avatar_url: actor.get('avatar_url'),
        contributor_profile_url: Frontend.Route.profile(actor) + clickthroughParams
      }
    })
  },

  sendDonationFromEmail: async function () {
    await this.load(['activity.post', 'activity.projectContribution', 'activity.projectContribution.project', 'activity.projectContribution.user'])
    const projectContribution = this.projectContribution()
    const project = this.post()
    const actor = this.actor()
    const reader = this.reader()
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'donation_from_email',
      cti: reader.id
    }).toString()

    return Email.sendDonationFromEmail({
      email: reader.get('email'),
      locale,
      sender: { name: project.summary() },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        project_title: project.summary(),
        project_url: Frontend.Route.post(project, null, clickthroughParams),
        contribution_amount: projectContribution.get('amount') / 100,
        contributor_name: actor.get('name'),
        contributor_avatar_url: actor.get('avatar_url'),
        contributor_profile_url: Frontend.Route.profile(actor) + clickthroughParams
      }
    })
  },

  sendEventInvitationEmail: async function () {
    const post = this.post()
    const reader = this.reader()
    const inviter = this.actor()
    const replyTo = Email.postReplyAddress(post.id, reader.id)
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()

    if (isEmpty(groupIds)) throw new Error('no group ids in activity')
    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'event_invitation_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendEventInvitationEmail({
      version: 'Redesign 2025',
      email: reader.get('email'),
      locale,
      sender: {
        address: replyTo,
        reply_to: replyTo,
        name: `${inviter.get('name')} (via Hylo)`
      },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_name: group.get('name'),
        post: post.presentForEmail({ group, clickthroughParams, locale }),
        tracking_pixel_url: Analytics.pixelUrl('Event Invitation', { userId: reader.id })
      }
    })
  },

  sendMemberJoinedGroupEmail: async function () {
    const actor = this.actor()
    const reader = this.reader()
    const groupIds = Activity.groupIds(this.relations.activity)
    const locale = this.locale()

    if (isEmpty(groupIds)) throw new Error('no group ids in activity')

    const group = await Group.find(groupIds[0])

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'member_joined_group_email',
      cti: reader.id,
      ctcn: group.get('name')
    }).toString()

    return Email.sendMemberJoinedGroupNotification({
      email: reader.get('email'),
      locale,
      sender: { name: actor.get('name') },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        group_name: group.get('name'),
        group_url: Frontend.Route.group(group) + clickthroughParams,
        group_avatar_url: group.get('avatar_url'),
        member_name: actor.get('name'),
        member_profile_url: Frontend.Route.profile(actor, group) + clickthroughParams,
        member_avatar_url: actor.get('avatar_url'),
        join_question_answers: await GroupJoinQuestionAnswer.latestAnswersFor(group.id, actor.id)
      }
    })
  },

  sendTrackCompletedEmail: async function () {
    const reader = this.reader()
    const actor = this.actor()
    const track = this.track()
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'track_completed_email',
      cti: reader.id,
      ctcn: track.get('name')
    }).toString()

    return Email.sendTrackCompletedEmail({
      email: reader.get('email'),
      locale,
      sender: { name: locales[locale].theTeamAtHylo },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        completer_name: actor.get('name'),
        completer_avatar_url: actor.get('avatar_url'),
        completer_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        track_name: track.get('name'),
        track_url: Frontend.Route.track(track) + clickthroughParams
      }
    })
  },

  sendTrackEnrollmentEmail: async function () {
    const reader = this.reader()
    const actor = this.actor()
    const track = this.track()
    const locale = this.locale()

    const clickthroughParams = '?' + new URLSearchParams({
      ctt: 'track_enrollment_email',
      cti: reader.id,
      ctcn: track.get('name')
    }).toString()

    return Email.sendTrackEnrollmentEmail({
      email: reader.get('email'),
      locale,
      sender: { name: actor.get('name') },
      data: {
        email_settings_url: Frontend.Route.notificationsSettings(clickthroughParams, reader),
        enrollee_name: actor.get('name'),
        enrollee_avatar_url: actor.get('avatar_url'),
        enrollee_profile_url: Frontend.Route.profile(actor) + clickthroughParams,
        track_name: track.get('name'),
        track_url: Frontend.Route.track(track) + clickthroughParams
      }
    })
  },

  shouldBeBlocked: async function () {
    if (!this.get('user_id')) return Promise.resolve(false)

    const blockedUserIds = (await BlockedUser.blockedFor(this.get('user_id'))).rows.map(r => r.user_id)
    if (blockedUserIds.length === 0) return Promise.resolve(false)

    const postCreatorId = get('relations.activity.relations.post.relations.user.id', this)
    const commentCreatorId = get('relations.activity.relations.comment.relations.user.id', this)
    const actorId = get('relations.activity.relations.actor.id', this)

    if (includes(postCreatorId, blockedUserIds) ||
        includes(commentCreatorId, blockedUserIds) ||
        includes(actorId, blockedUserIds)) {
      return Promise.resolve(true)
    }
    return Promise.resolve(false)
  },

  updateUserSocketRoom: async function (userId) {
    const { activity } = this.relations
    const { actor, comment, group, otherGroup, post } = activity.relations
    const action = Notification.priorityReason(activity.get('meta').reasons)

    const payload = {
      id: '' + this.id,
      activity: Object.assign({},
        refineOne(activity, ['created_at', 'id', 'meta', 'unread']),
        {
          action,
          actor: refineOne(actor, ['avatar_url', 'id', 'name']),
          comment: refineOne(comment, ['id', 'text']),
          group: refineOne(group, ['id', 'name', 'slug']),
          otherGroup: refineOne(otherGroup, ['id', 'name', 'slug']),
          post: refineOne(
            post,
            ['id', 'name', 'description'],
            { description: 'details', name: 'title' }
          )
        }
      )
    }
    RedisPubSub.publish(`updates:${userId}`, { notification: this })
    broadcast(userRoom(userId), 'newNotification', payload)
  }
}, {
  MEDIUM,
  TYPE,

  find: function (id, options) {
    if (!id) return Promise.resolve(null)
    return Notification.where({ id: id }).fetch(options)
  },

  findUnsent: function (options = {}) {
    return Notification.query(q => {
      q.where({ sent_at: null })
      if (!options.includeOld) {
        q.where('created_at', '>', bookshelf.knex.raw("now() - interval '6 hour'"))
      }
      q.where(function () {
        this.where('failed_at', null)
          .orWhere('failed_at', '<', bookshelf.knex.raw("now() - interval '1 hour'"))
      })
      q.limit(200)
    })
      .fetchAll(options)
  },

  sendUnsent: function () {
    // FIXME empty out this withRelated list and just load things on demand when
    // creating push notifications / emails
    return Notification.findUnsent({
      withRelated: [
        'activity',
        'activity.post',
        'activity.post.tags',
        'activity.post.groups',
        'activity.post.user',
        'activity.post.media',
        'activity.comment',
        'activity.comment.media',
        'activity.comment.user',
        'activity.comment.post',
        'activity.comment.post.user',
        'activity.comment.post.relatedUsers',
        'activity.comment.post.groups',
        'activity.group',
        'activity.otherGroup',
        'activity.reader',
        'activity.actor',
        'activity.track'
      ]
    })
      .then(ns => ns.length > 0 &&
        Promise.each(ns.models,
          n => n.send().catch(err => {
            console.error('Error sending notification', err, n.attributes)
            rollbar.error(err, null, { notification: n.attributes })
            return n.save({ failed_at: new Date() }, { patch: true })
          }))
          .then(() => new Promise(resolve => {
            setTimeout(() => resolve(Notification.sendUnsent()), 1000)
          })))
  },

  priorityReason: function (reasons) {
    const orderedLabels = [
      'donation to', 'donation from', 'announcement', 'eventInvitation', 'mention', 'commentMention', 'newComment', 'newContribution', 'chat', 'tag',
      'newPost', 'follow', 'followAdd', 'unfollow', 'joinRequest', 'approvedJoinRequest', 'groupChildGroupInviteAccepted', 'groupChildGroupInvite',
      'groupParentGroupJoinRequestAccepted', 'groupParentGroupJoinRequest', 'memberJoinedGroup', 'trackCompleted', 'trackEnrollment'
    ]

    const match = label => reasons.some(r => r.match(new RegExp('^' + label)))
    return orderedLabels.find(match) || ''
  },

  removeOldNotifications: function () {
    return Notification.query()
      .whereRaw("created_at < now() - interval '1 month'")
      .del()
  }
})
