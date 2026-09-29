/* eslint-disable no-unused-expressions */
// The READER_FILTERS phase of notification/rules: the emailed settings page's
// unsubscribe choices (D35).
import { mapValues } from 'lodash'
import { READER_FILTERS } from '../../../../api/models/notification/rules'
import {
  scopeAllowsBulkEmail,
  unsubscribeScopeFilter,
  unsubscribeScopeOf
} from '../../../../api/models/notification/rules/unsubscribeScope'
import { CHANNEL, SIGNAL_CLASS } from '../../../../api/models/notification/signalClasses'
import { daysAway, inactiveReaderFilter, lastSeenAt } from '../../../../api/models/notification/rules/inactiveReader'
import { emailTypeFor } from '../../../../lib/email/emailTypes'
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))

const { model } = factories.mock

const ALL = [CHANNEL.IN_APP, CHANNEL.PUSH, CHANNEL.EMAIL]

const makeGettable = obj => Object.assign({ get: key => obj[key], load: () => {} }, obj)

// A reader with these memberships and user attributes (settings, last_active_at, created_at)
function mockReader (memberships, attrs = {}) {
  return {
    id: 1,
    get: key => attrs[key],
    getSetting: key => attrs.settings?.[key],
    memberships: () => ({
      fetch: () => Promise.resolve({
        models: memberships.map(membershipAttrs => {
          const membership = GroupMembership.forge(membershipAttrs)
          membership.relations = mapValues(membershipAttrs.relations, makeGettable)
          return membership
        })
      })
    })
  }
}

const everyChannel = { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }

function postActivity (reasons, reader) {
  return model({
    meta: { reasons },
    post_id: 1,
    relations: {
      post: { relations: { groups: [{ id: 1 }] } },
      reader
    }
  })
}

const media = activity => Activity.generateNotificationMedia(activity)

const filtered = (scope, signalClass) => {
  const ctx = {
    reader: { get: key => key === 'settings' ? { email_unsubscribe_scope: scope } : undefined },
    signalClass,
    channels: new Set(ALL)
  }
  unsubscribeScopeFilter(ctx)
  return [...ctx.channels].sort()
}

describe('notification reader filters', () => {
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

  it('runs the unsubscribe choices and the inactivity throttle in the reader filters phase', () => {
    expect(READER_FILTERS).to.include(unsubscribeScopeFilter)
    expect(READER_FILTERS).to.include(inactiveReaderFilter)
  })

  describe('members who are away (D9)', () => {
    const DAY = 24 * 60 * 60 * 1000
    const away = days => ({ last_active_at: new Date(Date.now() - days * DAY), created_at: new Date(Date.now() - 900 * DAY) })
    const readerAway = (days, attrs = {}) =>
      mockReader([{ settings: everyChannel, relations: { group: { id: 1 } } }], { ...away(days), ...attrs })
    let all
    before(() => { all = [Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp] })

    function groupActivity (reasons, reader) {
      return model({ meta: { reasons }, group_id: 1, relations: { group: { id: 1 }, reader } })
    }

    it('keeps every channel for someone active in the last 30 days', async () => {
      expect(await media(postActivity(['newPost: 1'], readerAway(29)))).to.have.members(all)
    })

    it('after 30 days, a new post, topic post, announcement or chat is in-app only', async () => {
      for (const reasons of [['newPost: 1'], ['tag: garden'], ['newPost: 1', 'announcement'], ['chat']]) {
        expect(await media(postActivity(reasons, readerAway(31))), reasons.join()).to.deep.equal([Notification.MEDIUM.InApp])
      }
    })

    it('after 30 days, a mention still emails and pushes', async () => {
      expect(await media(postActivity(['mention'], readerAway(45)))).to.have.members(all)
    })

    it('between 30 and 180 days, other notices keep their channels', async () => {
      expect(await media(groupActivity(['joinRequest'], readerAway(90)))).to.have.members(all)
    })

    it('after 180 days, only direct signals leave the app', async () => {
      expect(await media(groupActivity(['joinRequest'], readerAway(200)))).to.deep.equal([Notification.MEDIUM.InApp])
      expect(await media(postActivity(['mention'], readerAway(200)))).to.have.members(all)
    })

    it('falls back to when they signed up when they were never active', async () => {
      const neverActive = readerAway(0, { last_active_at: null, created_at: new Date(Date.now() - 40 * DAY) })
      expect(await media(postActivity(['newPost: 1'], neverActive))).to.deep.equal([Notification.MEDIUM.InApp])

      const newcomer = readerAway(0, { last_active_at: null, created_at: new Date(Date.now() - 2 * DAY) })
      expect(await media(postActivity(['newPost: 1'], newcomer))).to.have.members(all)
    })

    it('treats someone with no dates at all as active', () => {
      expect(lastSeenAt({ get: () => null })).to.equal(null)
      expect(daysAway({ get: () => null })).to.equal(0)
    })
  })

  describe('unsubscribe choices (D35)', () => {
    it('reads only the four known values', () => {
      expect(unsubscribeScopeOf({ email_unsubscribe_scope: 'digest_only' })).to.equal('digest_only')
      expect(unsubscribeScopeOf({ email_unsubscribe_scope: 'some' })).to.equal(null)
      expect(unsubscribeScopeOf(null)).to.equal(null)
    })

    it("'digest_only' stops email for ambient signals only", () => {
      expect(filtered('digest_only', SIGNAL_CLASS.AMBIENT)).to.deep.equal([CHANNEL.IN_APP, CHANNEL.PUSH].sort())
      expect(filtered('digest_only', SIGNAL_CLASS.DIRECT)).to.deep.equal([...ALL].sort())
      expect(filtered('digest_only', SIGNAL_CLASS.OPERATIONAL)).to.deep.equal([...ALL].sort())
    })

    it("'no_group_emails' leaves it to the memberships' email switches", () => {
      expect(filtered('no_group_emails', SIGNAL_CLASS.AMBIENT)).to.deep.equal([...ALL].sort())
    })

    it("'all_but_direct' keeps direct signals on every channel and the rest in-app", () => {
      expect(filtered('all_but_direct', SIGNAL_CLASS.DIRECT)).to.deep.equal([...ALL].sort())
      for (const signalClass of [SIGNAL_CLASS.AMBIENT, SIGNAL_CLASS.SOCIAL, SIGNAL_CLASS.OPERATIONAL, SIGNAL_CLASS.LIFECYCLE]) {
        expect(filtered('all_but_direct', signalClass), signalClass).to.deep.equal([CHANNEL.IN_APP])
      }
    })

    it("'everything' keeps only in-app, even for direct signals", () => {
      expect(filtered('everything', SIGNAL_CLASS.DIRECT)).to.deep.equal([CHANNEL.IN_APP])
    })

    it('changes nothing without a choice', () => {
      expect(filtered(undefined, SIGNAL_CLASS.AMBIENT)).to.deep.equal([...ALL].sort())
    })

    describe('through generateNotificationMedia', () => {
      it("'all_but_direct': a mention still emails and pushes, a new post is in-app only", async () => {
        const reader = mockReader([{ settings: everyChannel, relations: { group: { id: 1 } } }],
          { settings: { email_unsubscribe_scope: 'all_but_direct' } })

        expect(await media(postActivity(['mention'], reader)))
          .to.have.members([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
        expect(await media(postActivity(['newPost: 1'], reader)))
          .to.deep.equal([Notification.MEDIUM.InApp])
      })

      it("'all_but_direct': an announcement that mentions the reader still emails and pushes", async () => {
        const reader = mockReader([{ settings: everyChannel, relations: { group: { id: 1 } } }],
          { settings: { email_unsubscribe_scope: 'all_but_direct' } })

        expect(await media(postActivity(['newPost: 1', 'announcement', 'mention'], reader)))
          .to.have.members([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
        expect(await media(postActivity(['newPost: 1', 'announcement'], reader)))
          .to.deep.equal([Notification.MEDIUM.InApp])
      })

      it("'digest_only': a new post no longer emails but still pushes", async () => {
        const reader = mockReader([{ settings: everyChannel, relations: { group: { id: 1 } } }],
          { settings: { email_unsubscribe_scope: 'digest_only' } })

        expect(await media(postActivity(['newPost: 1'], reader)))
          .to.have.members([Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
      })

      it('a reply to the reader is direct, so it keeps push under all_but_direct', async () => {
        const reader = mockReader([{ settings: everyChannel, relations: { group: { id: 1 } } }],
          { settings: { email_unsubscribe_scope: 'all_but_direct' } })
        const activity = model({
          meta: { reasons: ['newComment'] },
          reader_id: 1,
          comment_id: 2,
          post_id: 1,
          relations: {
            post: { user_id: 1, get: key => ({ user_id: 1 })[key], relations: { groups: [{ id: 1 }] } },
            reader
          }
        })
        expect(await media(activity)).to.include(Notification.MEDIUM.Push)
      })
    })

    describe('a group invitation, which skips the channel rules', () => {
      const invitation = reader => model({ meta: { reasons: ['groupInvitation'] }, group_id: 1, relations: { group: { id: 1 }, reader } })
      const readerWith = attrs => mockReader([], attrs)

      it('still pushes without a choice', async () => {
        expect(await media(invitation(readerWith({})))).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Push])
      })

      it("is in-app only for someone who chose 'everything' or 'everything except direct'", async () => {
        for (const scope of ['everything', 'all_but_direct']) {
          const reader = readerWith({ settings: { email_unsubscribe_scope: scope } })
          expect(await media(invitation(reader)), scope).to.deep.equal([Notification.MEDIUM.InApp])
        }
      })

      it('is in-app only for someone away 180 days or more (D9)', async () => {
        const reader = readerWith({ last_active_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) })
        expect(await media(invitation(reader))).to.deep.equal([Notification.MEDIUM.InApp])
      })
    })

    describe('notices to someone who asked to join, which skip the channel rules', () => {
      const requesterNotice = (reason, reader) => model({ meta: { reasons: [reason] }, group_id: 1, relations: { group: { id: 1 }, reader } })
      const readerWith = attrs => mockReader([], attrs)
      const dormant = { last_active_at: new Date(Date.now() - 200 * 24 * 60 * 60 * 1000) }

      it('keeps the email for the acknowledgment and the decline, which answer their own request', async () => {
        for (const reason of ['acknowledgedJoinRequest', 'declinedJoinRequest']) {
          for (const attrs of [{}, { settings: { email_unsubscribe_scope: 'everything' } }, { settings: { email_unsubscribe_scope: 'all_but_direct' } }, dormant]) {
            expect(await media(requesterNotice(reason, readerWith(attrs))), reason).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Email])
          }
        }
      })

      it('sends the 14-day note in-app only under an unsubscribe choice or after 180 days away', async () => {
        expect(await media(requesterNotice('unansweredJoinRequest', readerWith({})))).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Email])
        for (const attrs of [{ settings: { email_unsubscribe_scope: 'digest_only' } }, dormant]) {
          expect(await media(requesterNotice('unansweredJoinRequest', readerWith(attrs)))).to.deep.equal([Notification.MEDIUM.InApp])
        }
      })
    })

    describe('bulk email outside notifications (Email.js)', () => {
      it('never stops essential email', () => {
        for (const scope of ['digest_only', 'no_group_emails', 'all_but_direct', 'everything']) {
          expect(scopeAllowsBulkEmail(scope, emailTypeFor('sendPasswordReset')), scope).to.equal(true)
          expect(scopeAllowsBulkEmail(scope, emailTypeFor('sendPaymentFailed')), scope).to.equal(true)
          expect(scopeAllowsBulkEmail(scope, emailTypeFor('sendSubscriptionRenewalReminder')), scope).to.equal(true)
        }
      })

      it("'all_but_direct' lets only direct email through", () => {
        expect(scopeAllowsBulkEmail('all_but_direct', emailTypeFor('sendMessageDigest'))).to.equal(true)
        expect(scopeAllowsBulkEmail('all_but_direct', emailTypeFor('sendPostMentionNotification'))).to.equal(true)
        expect(scopeAllowsBulkEmail('all_but_direct', emailTypeFor('sendWelcomeEmail'))).to.equal(false)
        expect(scopeAllowsBulkEmail('all_but_direct', emailTypeFor('sendSimpleEmail'))).to.equal(false)
        expect(scopeAllowsBulkEmail('all_but_direct', null)).to.equal(false)
      })

      it('lets one send mark itself direct, such as an announcement that mentions the reader', () => {
        const postEmail = emailTypeFor('sendPostNotification')
        expect(scopeAllowsBulkEmail('all_but_direct', postEmail)).to.equal(false)
        expect(scopeAllowsBulkEmail('all_but_direct', postEmail, { direct: true })).to.equal(true)
        expect(scopeAllowsBulkEmail('everything', postEmail, { direct: true })).to.equal(false)
      })

      it("'everything' stops all bulk email; the other choices leave it to the senders", () => {
        expect(scopeAllowsBulkEmail('everything', emailTypeFor('sendMessageDigest'))).to.equal(false)
        expect(scopeAllowsBulkEmail('digest_only', emailTypeFor('sendWelcomeEmail'))).to.equal(true)
        expect(scopeAllowsBulkEmail(null, emailTypeFor('sendWelcomeEmail'))).to.equal(true)
      })
    })
  })
})
