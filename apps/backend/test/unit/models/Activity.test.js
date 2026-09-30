/* eslint-disable no-unused-expressions */
const { mapValues } = require('lodash')
const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))

const { model } = factories.mock

const makeGettable = obj => Object.assign({ get: key => obj[key], load: () => {} }, obj)

function mockUser (memberships, settings = {}) {
  return {
    getSetting: (setting) => settings[setting],
    memberships: () => {
      return {
        fetch: () => Promise.resolve({
          models: memberships.map(attrs => {
            const membership = GroupMembership.forge(attrs)
            membership.relations = mapValues(attrs.relations, makeGettable)
            return membership
          })
        })
      }
    }
  }
}

describe('Activity', function () {
  describe('.generateNotificationMedia when postNotifications = important', () => {
    const userSettings = { post_notifications: 'important' }
    let originalEmailNotificationsEnabled
    let originalPushNotificationsEnabled

    beforeEach(() => {
      originalEmailNotificationsEnabled = process.env.EMAIL_NOTIFICATIONS_ENABLED
      originalPushNotificationsEnabled = process.env.PUSH_NOTIFICATIONS_ENABLED
      process.env.EMAIL_NOTIFICATIONS_ENABLED = 'true'
      process.env.PUSH_NOTIFICATIONS_ENABLED = 'true'
    })

    afterEach(() => {
      process.env.EMAIL_NOTIFICATIONS_ENABLED = originalEmailNotificationsEnabled
      process.env.PUSH_NOTIFICATIONS_ENABLED = originalPushNotificationsEnabled
    })

    it('returns an in-app notification from a mention', async () => {
      const memberships = [
        {
          settings: {},
          relations: {
            group: { id: 1 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['mention'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const expected = [Notification.MEDIUM.InApp]

      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal(expected)
    })

    it("doesn't returns an email for a newPost if post_notifications = none", async () => {
      const memberships = [
        {
          settings: { sendEmail: true },
          relations: {
            group: { id: 1 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['newPost: 1'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }, { id: 2 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const expected = []
      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal(expected)
    })

    it('returns an in-app notification for a chat when postNotifications = all', async () => {
      const memberships = [
        {
          settings: { postNotifications: 'all' },
          relations: {
            group: { id: 1 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['chat'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal([Notification.MEDIUM.InApp])
    })

    it('does not notify for a chat when postNotifications = none', async () => {
      const memberships = [
        {
          settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' },
          relations: {
            group: { id: 1 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['chat'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal([])
    })

    it('returns a push and email for an announcement post if post_notifications = important', async () => {
      const memberships = [
        {
          settings: { sendPushNotifications: true, sendEmail: true, postNotifications: 'important' },
          getSetting: (key) => this.settings[key],
          relations: {
            group: { id: 1 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['newPost: 1', 'announcement'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }, { id: 2 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const expected = [
        Notification.MEDIUM.Email,
        Notification.MEDIUM.Push,
        Notification.MEDIUM.InApp
      ]

      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal(expected)
    })

    it('returns a push and an email for different groups', async () => {
      const memberships = [
        {
          settings: { sendEmail: true },
          getSetting: (key) => this.settings[key],
          relations: {
            group: { id: 1 }
          }
        },
        {
          settings: { sendPushNotifications: true },
          getSetting: (key) => this.settings[key],
          relations: {
            group: { id: 2 }
          }
        }
      ]

      const activity = model({
        meta: { reasons: ['mention'] },
        post_id: 1,
        relations: {
          post: {
            relations: {
              groups: [{ id: 1 }, { id: 2 }]
            }
          },
          reader: mockUser(memberships, userSettings)
        }
      })

      const expected = [
        Notification.MEDIUM.Email,
        Notification.MEDIUM.Push,
        Notification.MEDIUM.InApp
      ]

      const actual = await Activity.generateNotificationMedia(activity)
      expect(actual).to.deep.equal(expected)
    })
  })

  describe('.generateNotificationMedia for mentions when postNotifications = none', () => {
    const activityFor = (reasons, settings) => model({
      meta: { reasons },
      post_id: 1,
      relations: {
        post: { relations: { groups: [{ id: 1 }] } },
        reader: mockUser([{ settings, relations: { group: { id: 1 } } }])
      }
    })

    it('delivers a post mention in-app, by email and by push when the group allows both', async () => {
      const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['mention', 'newPost: 1'], settings))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it('follows the group email and push toggles for a post mention', async () => {
      const settings = { sendEmail: false, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['mention', 'newPost: 1'], settings))
      expect(actual).to.deep.equal([Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it('delivers a chat mention by push and in-app, never by email', async () => {
      const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['mention', 'chat'], settings))
      expect(actual).to.deep.equal([Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it('still sends nothing for a plain new post', async () => {
      const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['newPost: 1'], settings))
      expect(actual).to.deep.equal([])
    })

    it('still sends nothing for a plain chat', async () => {
      const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['chat'], settings))
      expect(actual).to.deep.equal([])
    })

    it('still sends nothing for an announcement', async () => {
      const settings = { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }
      const actual = await Activity.generateNotificationMedia(activityFor(['newPost: 1', 'announcement: 1'], settings))
      expect(actual).to.deep.equal([])
    })
  })

  describe('.generateNotificationMedia for a post in a space', () => {
    const parentGroup = { id: 1 }
    const space = { id: 2, type: 'space', parent_id: 1 }

    const spacePostActivity = memberships => model({
      meta: { reasons: ['newPost: 2'] },
      post_id: 1,
      relations: {
        post: {
          relations: {
            groups: [{ id: 2 }]
          }
        },
        reader: mockUser(memberships)
      }
    })

    it("uses the parent group's email setting instead of the space membership's", async () => {
      const memberships = [
        { settings: { sendEmail: false, sendPushNotifications: true }, relations: { group: parentGroup } },
        { settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }, relations: { group: space } }
      ]
      const actual = await Activity.generateNotificationMedia(spacePostActivity(memberships))
      expect(actual).to.deep.equal([Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it("uses the parent group's push setting instead of the space membership's", async () => {
      const memberships = [
        { settings: { sendEmail: true, sendPushNotifications: false }, relations: { group: parentGroup } },
        { settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }, relations: { group: space } }
      ]
      const actual = await Activity.generateNotificationMedia(spacePostActivity(memberships))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.InApp])
    })

    it('turns channels on for a space when the parent group has them on', async () => {
      const memberships = [
        { settings: { sendEmail: true, sendPushNotifications: true }, relations: { group: parentGroup } },
        { settings: { sendEmail: false, sendPushNotifications: false, postNotifications: 'all' }, relations: { group: space } }
      ]
      const actual = await Activity.generateNotificationMedia(spacePostActivity(memberships))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it("falls back to the space membership's settings without a parent membership", async () => {
      const memberships = [
        { settings: { sendEmail: true, sendPushNotifications: false, postNotifications: 'all' }, relations: { group: space } }
      ]
      const actual = await Activity.generateNotificationMedia(spacePostActivity(memberships))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.InApp])
    })

    it("still uses the space membership's post setting", async () => {
      const memberships = [
        { settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }, relations: { group: parentGroup } },
        { settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'none' }, relations: { group: space } }
      ]
      const actual = await Activity.generateNotificationMedia(spacePostActivity(memberships))
      expect(actual).to.deep.equal([])
    })
  })

  describe('.generateNotificationMedia email medium', () => {
    const memberships = [
      { settings: { sendEmail: true, sendPushNotifications: true, postNotifications: 'all' }, relations: { group: { id: 1 } } }
    ]

    const activityFor = reasons => model({
      meta: { reasons },
      post_id: 1,
      relations: {
        post: {
          relations: {
            groups: [{ id: 1 }]
          }
        },
        reader: mockUser(memberships)
      }
    })

    for (const reasons of [['newComment'], ['commentMention'], ['voteReset'], ['newContribution']]) {
      it(`is not added for ${reasons[0]}, which has no email`, async () => {
        const actual = await Activity.generateNotificationMedia(activityFor(reasons))
        expect(actual).to.deep.equal([Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
      })
    }

    it('is added for a new post', async () => {
      const actual = await Activity.generateNotificationMedia(activityFor(['newPost: 1']))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })

    it('is added for a mention in a new post', async () => {
      const actual = await Activity.generateNotificationMedia(activityFor(['mention', 'newPost: 1']))
      expect(actual).to.deep.equal([Notification.MEDIUM.Email, Notification.MEDIUM.Push, Notification.MEDIUM.InApp])
    })
  })

  describe('#createWithNotifications', () => {
    let fixtures

    before(() =>
      setup.clearDb()
        .then(() => Promise.props({
          u1: factories.user({ settings: { post_notifications: 'all' } }).save(),
          u2: factories.user().save(),
          g1: factories.group().save(),
          c2: factories.group().save(),
          p1: factories.post().save(),
          p2: factories.post().save()
        }))
        .then(props => { fixtures = props })
        .then(() => Promise.join(
          fixtures.g1.posts().attach(fixtures.p1),
          fixtures.g1.posts().attach(fixtures.p2),
          fixtures.c2.posts().attach(fixtures.p2),
          fixtures.u1.joinGroup(fixtures.g1),
          fixtures.u1.joinGroup(fixtures.c2)
        )))

    it('creates an in-app notification from a mention', () => {
      return Activity.createWithNotifications({
        post_id: fixtures.p1.id,
        reader_id: fixtures.u1.id,
        actor_id: fixtures.u2.id,
        meta: { reasons: ['mention'] }
      })
        .then(activity =>
          Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.InApp })
            .fetch())
        .then(notification => {
          expect(notification).to.exist
          expect(notification.get('sent_at')).to.be.null
          expect(notification.get('user_id')).to.equal(fixtures.u1.id)
        })
    })

    it('creates a push notification when the group setting is true', async () => {
      await fixtures.g1.addMembers([fixtures.u1.id], {
        settings: { sendPushNotifications: true }
      })
      const activity = await Activity.createWithNotifications({
        post_id: fixtures.p1.id,
        reader_id: fixtures.u1.id,
        actor_id: fixtures.u2.id,
        meta: { reasons: ['mention'] }
      })
      const notification = await Notification.where({
        activity_id: activity.id, medium: Notification.MEDIUM.Push
      }).fetch()
      expect(notification).to.exist
      expect(notification.get('sent_at')).to.be.null
    })

    it('creates an email notification when the group setting is true', () => {
      return fixtures.g1.addMembers([fixtures.u1.id], {
        settings: { sendEmail: true }
      })
        .then(() => Activity.createWithNotifications({
          post_id: fixtures.p1.id,
          reader_id: fixtures.u1.id,
          actor_id: fixtures.u2.id,
          meta: { reasons: ['mention'] }
        }))
        .then(activity =>
          Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Email })
            .fetch())
        .then(notification => {
          expect(notification).to.exist
          expect(notification.get('sent_at')).to.be.null
        })
    })

    it("doesn't create a push notification when the group setting is false", () => {
      return fixtures.g1.addMembers([fixtures.u1.id], {
        settings: { sendPushNotifications: false }
      })
        .then(() => Activity.createWithNotifications({
          post_id: fixtures.p1.id,
          reader_id: fixtures.u1.id,
          actor_id: fixtures.u2.id,
          meta: { reasons: ['mention'] }
        }))
        .then(activity =>
          Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Push })
            .fetch())
        .then(notification => {
          expect(notification).not.to.exist
        })
    })

    it("doesn't create an email when the group setting is false", () => {
      return fixtures.g1.addMembers([fixtures.u1.id], {
        settings: { sendEmail: false }
      })
        .then(() => Activity.createWithNotifications({
          post_id: fixtures.p1.id,
          reader_id: fixtures.u1.id,
          actor_id: fixtures.u2.id,
          meta: { reasons: ['mention'] }
        }))
        .then(activity =>
          Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Push })
            .fetch())
        .then(notification => {
          expect(notification).not.to.exist
        })
    })

    it('creates in-app and email for new posts ', () => {
      // A reader on 'all' (new memberships start on 'important', D1)
      return fixtures.g1.addMembers([fixtures.u1.id], {
        settings: { sendPushNotifications: true, sendEmail: true, postNotifications: 'all' }
      })
        .then(() => Activity.createWithNotifications({
          post_id: fixtures.p1.id,
          reader_id: fixtures.u1.id,
          actor_id: fixtures.u2.id,
          meta: { reasons: [`newPost: ${fixtures.g1.id}`] }
        }))
        .then(activity =>
          Promise.join(
            Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.InApp })
              .fetch(),
            Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Email })
              .fetch(),
            Notification.where({ activity_id: activity.id, medium: Notification.MEDIUM.Push })
              .fetch(),
            (inApp, email, push) => {
              expect(inApp).to.exist
              expect(email).to.exist
              expect(push).to.exist
            }))
    })
  })

  describe('#createNotifications signal class for comment replies', () => {
    const { READER_FILTERS } = require(root('api/models/notification/rules'))
    let reader, replier, postAuthor, post, recordClass, seenClasses

    before(async () => {
      await setup.clearDb()
      reader = await factories.user().save()
      replier = await factories.user().save()
      postAuthor = await factories.user().save()
      const group = await factories.group().save()
      post = await factories.post({ user_id: postAuthor.id }).save()
      await group.posts().attach(post)
      await reader.joinGroup(group)
    })

    beforeEach(() => {
      seenClasses = []
      recordClass = ctx => { seenClasses.push(ctx.signalClass) }
      READER_FILTERS.push(recordClass)
    })

    afterEach(() => {
      READER_FILTERS.splice(READER_FILTERS.indexOf(recordClass), 1)
    })

    const replyUnder = async parent => {
      const reply = await factories.comment({ post_id: post.id, user_id: replier.id, comment_id: parent.id }).save()
      return Activity.createWithNotifications({
        post_id: post.id,
        comment_id: reply.id,
        parent_comment_id: parent.id,
        reader_id: reader.id,
        actor_id: replier.id,
        meta: { reasons: ['newComment'] }
      })
    }

    it("treats a reply under the reader's own comment as direct", async () => {
      const parent = await factories.comment({ post_id: post.id, user_id: reader.id }).save()
      await replyUnder(parent)
      expect(seenClasses).to.deep.equal(['direct'])
    })

    it("treats a reply under someone else's comment as social", async () => {
      const parent = await factories.comment({ post_id: post.id, user_id: postAuthor.id }).save()
      await replyUnder(parent)
      expect(seenClasses).to.deep.equal(['social'])
    })
  })

  describe('#forComment', function () {
    let comment
    before(function () {
      comment = new Comment({
        id: '4',
        user_id: '5',
        post_id: '6',
        text: 'foo'
      })
    })

    it('works', function () {
      const activity = Activity.forComment(comment, '7')

      expect(activity.get('comment_id')).to.equal('4')
      expect(activity.get('actor_id')).to.equal('5')
      expect(activity.get('post_id')).to.equal('6')
      expect(activity.get('meta')).to.deep.equal({ reasons: ['comment'] })
    })

    it('sets action = "mention" for mentions', function () {
      comment.set('text', 'yo <a class="mention" data-type="mention" data-id="7" data-label="Bob">Bob</a>!')
      const activity = Activity.forComment(comment, '7')

      expect(activity.get('comment_id')).to.equal('4')
      expect(activity.get('actor_id')).to.equal('5')
      expect(activity.get('post_id')).to.equal('6')
      expect(activity.get('meta')).to.deep.equal({ reasons: ['mention'] })
    })
  })
})
