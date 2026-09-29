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

  it('runs the unsubscribe choices in the reader filters phase', () => {
    expect(READER_FILTERS).to.include(unsubscribeScopeFilter)
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

      it("'everything' stops all bulk email; the other choices leave it to the senders", () => {
        expect(scopeAllowsBulkEmail('everything', emailTypeFor('sendMessageDigest'))).to.equal(false)
        expect(scopeAllowsBulkEmail('digest_only', emailTypeFor('sendWelcomeEmail'))).to.equal(true)
        expect(scopeAllowsBulkEmail(null, emailTypeFor('sendWelcomeEmail'))).to.equal(true)
      })
    })
  })
})
