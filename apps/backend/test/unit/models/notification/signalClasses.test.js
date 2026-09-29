/* eslint-disable no-unused-expressions */
import { mapValues } from 'lodash'
import '../../../setup'
import factories from '../../../setup/factories'
import { PRIORITY_REASONS } from '../../../../api/models/notification/priorityReasons'
import {
  CLASS_CHANNELS,
  REASON_SIGNALS,
  SIGNAL_CLASS,
  channelsForReason,
  classForActivity,
  signalForReason
} from '../../../../api/models/notification/signalClasses'

const { model } = factories.mock

const makeGettable = obj => Object.assign({ get: key => obj[key], load: () => {} }, obj)

function readerWithMembership (settings) {
  return {
    getSetting: () => undefined,
    memberships: () => ({
      fetch: () => {
        const membership = GroupMembership.forge({ settings })
        membership.relations = { group: makeGettable({ id: 1 }) }
        return Promise.resolve({ models: [membership] })
      }
    })
  }
}

const activityFor = (reasons, settings) => model({
  meta: { reasons },
  post_id: 1,
  relations: {
    post: { relations: { groups: [{ id: 1 }] } },
    reader: readerWithMembership(settings)
  }
})

const names = media => media.map(m => ({
  [Notification.MEDIUM.Email]: 'email',
  [Notification.MEDIUM.Push]: 'push',
  [Notification.MEDIUM.InApp]: 'inApp'
})[m])

// What each priority reason created before the class table existed, for a member on
// "Every post" with email and push on. Changing a line here changes delivery.
const TODAY = {
  'donation to': ['email', 'push', 'inApp'],
  'donation from': ['email', 'push', 'inApp'],
  announcement: ['email', 'push', 'inApp'],
  eventInvitation: ['email', 'push', 'inApp'],
  mention: ['email', 'push', 'inApp'],
  commentMention: ['push', 'inApp'],
  newComment: ['push', 'inApp'],
  newContribution: ['push', 'inApp'],
  chat: ['push', 'inApp'],
  tag: ['email', 'push', 'inApp'],
  newPost: ['email', 'push', 'inApp'],
  follow: ['push', 'inApp'],
  followAdd: ['push', 'inApp'],
  unfollow: ['push', 'inApp'],
  postFulfilled: ['email', 'push', 'inApp'],
  postUnfulfilled: ['email', 'push', 'inApp'],
  joinRequest: ['email', 'push', 'inApp'],
  approvedJoinRequest: ['email', 'push', 'inApp'],
  groupInvitation: ['inApp', 'push'],
  groupChildGroupInviteAccepted: ['email', 'push', 'inApp'],
  groupChildGroupInvite: ['email', 'push', 'inApp'],
  groupParentGroupJoinRequestAccepted: ['email', 'push', 'inApp'],
  groupParentGroupJoinRequest: ['email', 'push', 'inApp'],
  groupPeerGroupInviteAccepted: ['email', 'push', 'inApp'],
  groupPeerGroupInvite: ['email', 'push', 'inApp'],
  memberJoinedGroup: ['email', 'push', 'inApp'],
  trackCompleted: ['email', 'push', 'inApp'],
  trackEnrollment: ['email', 'push', 'inApp'],
  fundingRoundNewSubmission: ['email', 'push', 'inApp'],
  fundingRoundPhaseTransition: ['email', 'push', 'inApp'],
  fundingRoundReminder: ['email', 'push', 'inApp'],
  // D14: to someone who asked to join, who isn't a member (rules/nonMemberRequester)
  acknowledgedJoinRequest: ['inApp', 'email'],
  declinedJoinRequest: ['inApp', 'email'],
  unansweredJoinRequest: ['inApp', 'email']
}

// Reasons whose media don't depend on a group membership's email and push toggles
const MEMBERSHIP_INDEPENDENT = ['groupInvitation', 'acknowledgedJoinRequest', 'declinedJoinRequest', 'unansweredJoinRequest']

describe('signalClasses', () => {
  it('gives every priority reason a class', () => {
    for (const reason of PRIORITY_REASONS) {
      expect(REASON_SIGNALS[reason], reason).to.exist
      expect(Object.values(SIGNAL_CLASS)).to.include(REASON_SIGNALS[reason].class)
    }
  })

  it('has a parity snapshot line for every priority reason', () => {
    expect(Object.keys(TODAY).sort()).to.deep.equal([...PRIORITY_REASONS].sort())
  })

  it('lets a line that sets its own channels override its class', () => {
    expect(signalForReason('chat').class).to.equal(SIGNAL_CLASS.AMBIENT)
    expect(channelsForReason('chat')).to.deep.equal(['inApp', 'push'])
    expect(channelsForReason('newPost')).to.deep.equal(CLASS_CHANNELS[SIGNAL_CLASS.AMBIENT])
  })

  it('keeps every channel for a reason with no line', () => {
    expect(signalForReason('somethingNew').class).to.equal(null)
    expect(channelsForReason('somethingNew')).to.deep.equal(['inApp', 'push', 'email'])
  })

  describe('classForActivity', () => {
    const commentActivity = ({ readerId, postAuthorId, parentAuthorId }) => model({
      reader_id: readerId,
      comment_id: 10,
      relations: {
        post: model({ user_id: postAuthorId }),
        parentComment: parentAuthorId ? model({ user_id: parentAuthorId }) : undefined
      }
    })

    it('treats a comment on your own post as direct', () => {
      expect(classForActivity(commentActivity({ readerId: 5, postAuthorId: 5 }), 'newComment')).to.equal(SIGNAL_CLASS.DIRECT)
    })

    it('treats a reply under your comment as direct', () => {
      expect(classForActivity(commentActivity({ readerId: 5, postAuthorId: 6, parentAuthorId: 5 }), 'newComment')).to.equal(SIGNAL_CLASS.DIRECT)
    })

    it('leaves other comments on posts you follow social', () => {
      expect(classForActivity(commentActivity({ readerId: 5, postAuthorId: 6 }), 'newComment')).to.equal(SIGNAL_CLASS.SOCIAL)
    })

    it('classes mentions as direct', () => {
      expect(classForActivity(model({}), 'mention')).to.equal(SIGNAL_CLASS.DIRECT)
      expect(classForActivity(model({}), 'commentMention')).to.equal(SIGNAL_CLASS.DIRECT)
    })
  })

  describe('parity with the channels before the class table', () => {
    let originalEmail, originalPush
    beforeEach(() => {
      originalEmail = process.env.EMAIL_NOTIFICATIONS_ENABLED
      originalPush = process.env.PUSH_NOTIFICATIONS_ENABLED
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
      process.env.PUSH_NOTIFICATIONS_ENABLED = 'true'
    })
    afterEach(() => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmail
      process.env.PUSH_NOTIFICATIONS_ENABLED = originalPush
    })

    const everyPost = { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }

    for (const [reason, expected] of Object.entries(TODAY)) {
      it(`keeps ${reason} on ${expected.join(', ')}`, async () => {
        const media = await Activity.generateNotificationMedia(activityFor([reason], everyPost))
        expect(names(media)).to.deep.equal(expected)
      })
    }

    it('keeps channels when email and push are off for the group', async () => {
      const off = { sendEmail: false, sendPushNotifications: false, postNotifications: 'all' }
      const results = {}
      for (const reason of PRIORITY_REASONS) {
        results[reason] = names(await Activity.generateNotificationMedia(activityFor([reason], off)))
      }
      expect(results).to.deep.equal(mapValues(TODAY, (media, reason) =>
        MEMBERSHIP_INDEPENDENT.includes(reason) ? media : ['inApp']))
    })
  })
})
