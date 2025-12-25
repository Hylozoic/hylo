/* eslint-disable no-unused-expressions */

import '../../setup'
import root from 'root-path'
import bcrypt from 'bcrypt'
import crypto from 'crypto'
import factories from '../../setup/factories'
import { wait, spyify, unspyify } from '../../setup/helpers'
import { times } from 'lodash'
import setup from '../../setup'

describe('User', function () {
  let cat

  before(function () {
    cat = new User({ name: 'Cat', email: 'Iam@cat.org', active: true })
    return cat.save()
  })

  it('can be found', function () {
    return User.find('Cat').then(function (user) {
      expect(user).to.exist
      expect(user.get('name')).to.equal('Cat')
    })
  })

  it('can be found with case-insensitive email match', function () {
    return User.find('iAm@cAt.org').then(user => {
      expect(user).to.exist
      expect(user.get('name')).to.equal('Cat')
    })
  })

  it('can be found with ID', function () {
    return User.find(cat.id).then(user => {
      expect(user).to.exist
      expect(user.get('name')).to.equal('Cat')
    })
  })

  it('cannot be found if inactive', () => {
    const dog = new User({name: 'Dog', email: 'iam@dog.org'})
    let dogId
    return dog.save()
    .tap(dog => { dogId = dog.id })
    .then(() => User.find('Dog'))
    .then(dog => expect(dog).not.to.exist)
    .then(() => User.find('iam@dog.org'))
    .then(dog => expect(dog).not.to.exist)
    .then(() => User.find(dogId))
    .then(dog => expect(dog).not.to.exist)
  })

  it('can join groups', function () {
    let group1 = new Group({ name: 'House', slug: 'house', group_data_type: 1 })
    let group2 = new Group({ name: 'Yard', slug: 'yard', group_data_type: 1 })

    return Promise.join(
      group1.save(),
      group2.save()
    )
    .then(() => Promise.join(
      cat.joinGroup(group1),
      cat.joinGroup(group2)
    ))
    .then(() => cat.groups().fetch())
    .then(function (groups) {
      expect(groups).to.exist
      expect(groups.models).to.exist
      expect(groups.models).not.to.be.empty
      let names = groups.models.map(c => c.get('name')).sort()
      expect(names[0]).to.equal('House')
      expect(names[1]).to.equal('Yard')
    })
    .then(() => GroupMembership.forPair(cat, group1).fetch())
    .then(membership => {
      expect(membership).to.exist
      const settings = membership.get('settings')
      expect(settings.sendEmail).to.equal(true)
      expect(settings.sendPushNotifications).to.equal(true)
    })
  })

  it('can become moderator', function () {
    const street = new Group({ name: 'Street', slug: 'street', group_data_type: 1 })

    return street.save()
    .then(() => cat.joinGroup(street, { role: GroupMembership.Role.MODERATOR }))
    .then(() => GroupMembership.forPair(cat, street).fetch())
    .then(membership => {
      expect(membership).to.exist
      expect(membership.get('role')).to.equal(1)
    })
  })

  describe('#setSanely', function () {
    it("doesn't assume that any particular field is set", function () {
      new User().setSanely({})
    })

    it('sanitizes twitter usernames', function () {
      let user = new User()

      user.setSanely({twitter_name: '@user'})
      expect(user.get('twitter_name')).to.equal('user')

      user.setSanely({twitter_name: ' '})
      expect(user.get('twitter_name')).to.be.null
    })

    it("doesn't add url, facebook_url or linkedin_url if not provided", function () {
      let user = new User()

      user.setSanely({})

      expect(user.get('url')).to.equal(undefined)
      expect(user.get('facebook_url')).to.equal(undefined)
      expect(user.get('linkedin_url')).to.equal(undefined)
    })

    it('adds protocol to url, facebook_url and linkedin_url', function () {
      let user = new User()

      user.setSanely({
        url: 'myawesomesite.com',
        facebook_url: 'www.facebook.com/user/123',
        linkedin_url: 'linkedin.com/user/123'
      })

      expect(user.get('url')).to.equal('https://myawesomesite.com')
      expect(user.get('facebook_url')).to.equal('https://www.facebook.com/user/123')
      expect(user.get('linkedin_url')).to.equal('https://linkedin.com/user/123')

      user.setSanely({linkedin_url: 'http://linkedin.com/user/123'})
      expect(user.get('linkedin_url')).to.equal('http://linkedin.com/user/123')
    })

    it('preserves existing settings keys', () => {
      const user = new User({
        settings: {
          a: 'eh',
          b: 'bee',
          c: { sea: true }
        }
      })

      user.setSanely({
        settings: {
          b: 'buh',
          c: { see: true }
        }
      })
      expect(user.get('settings')).to.deep.equal({
        a: 'eh',
        b: 'buh',
        c: {
          sea: true,
          see: true
        }
      })
    })
  })

  describe('#groupsSharedWithPost', () => {
    let user, post, c1, c2, c3, c4
    before(() => {
      user = factories.user()
      post = factories.post()
      c1 = factories.group()
      c2 = factories.group()
      c3 = factories.group()
      c4 = factories.group()
      return Promise.join(
        user.save(), post.save(), c1.save(), c2.save(), c3.save(), c4.save())
        .then(() => post.groups().attach([c1, c2, c3]))
        .then(() => user.joinGroup(c2))
        .then(() => user.joinGroup(c3))
        .then(() => user.joinGroup(c4))
    })

    it('returns the shared groups', () => {
      return user.groupsSharedWithPost(post)
        .then(cs => {
          expect(cs.length).to.equal(2)
          expect(cs.map(c => c.id).sort()).to.deep.equal([c2.id, c3.id].sort())
        })
    })
  })

  describe('.authenticate', function () {
    before(function () {
      return new LinkedAccount({
        provider_user_id: '$2a$10$UPh85nJvMSrm6gMPqYIS.OPhLjAMbZiFnlpjq1xrtoSBTyV6fMdJS',
        provider_key: 'password',
        user_id: cat.id
      }).save()
    })

    it('accepts a valid password', function () {
      return expect(User.authenticate('iam@cat.org', 'password'))
        .to.eventually.satisfy(function (user) {
          return user && user.id === cat.id && user.name === cat.name
        })
    })

    it('rejects an invalid password', function () {
      return expect(User.authenticate('iam@cat.org', 'pawsword')).to.be.rejected
    })
  })

  describe('.create', function () {
    const catPic = 'http://i.imgur.com/Kwe1K7k.jpg'
    let group

    before(function () {
      group = new Group({name: 'foo', slug: 'foo', group_data_type: 1})
      return group.save()
    })

    it('rejects an invalid email address', () => {
      return User.create({
        email: 'foo@bar@com',
        group,
        account: { type: 'password', password: 'password' },
        name: 'foo bar'
      })
        .then(user => expect.fail())
        .catch(err => expect(err.message).to.equal('invalid-email'))
    })

    it('rejects a blank email address', () => {
      return User.create({
        email: null,
        group,
        account: { type: 'password', password: 'password' }
      })
        .then(user => expect.fail())
        .catch(err => expect(err.message).to.equal('invalid-email'))
    })

    it('works with a password', function () {
      return User.create({
        email: 'foo@bar.com',
        account: {type: 'password', password: 'password!'},
        name: 'foo bar'
      })
        .then(async function (user) {
          await group.addMembers([user.id])
          expect(user.id).to.exist
          expect(user.get('active')).to.be.true
          expect(user.get('name')).to.equal('foo bar')
          expect(user.get('avatar_url')).to.equal(User.gravatar('foo@bar.com'))
          expect(user.get('created_at').getTime()).to.be.closeTo(new Date().getTime(), 2000)
          expect(user.get('settings').dm_notifications).to.equal('both')
          expect(user.get('settings').comment_notifications).to.equal('both')

          return Promise.join(
            LinkedAccount.where({user_id: user.id}).fetch().then(function (account) {
              expect(account).to.exist
              expect(account.get('provider_key')).to.equal('password')
              expect(bcrypt.compareSync('password!', account.get('provider_user_id'))).to.be.true
            }),
            GroupMembership.forPair(user, group).fetch()
              .then(membership => expect(membership).to.exist)
          )
        })
    })

    it('works with google', function () {
      return User.create({
        name: 'foo2 moo2 wow',
        email: 'foo2.moo2_wow@bar.com',
        account: { type: 'google', profile: { id: 'foo' } }
      })
        .then(async function (user) {
          await group.addMembers([user.id])

          expect(user.id).to.exist
          expect(user.get('active')).to.be.true
          expect(user.get('name')).to.equal('foo2 moo2 wow')

          return Promise.join(
            LinkedAccount.where({user_id: user.id}).fetch().then(function (account) {
              expect(account).to.exist
              expect(account.get('provider_key')).to.equal('google')
              expect(account.get('provider_user_id')).to.equal('foo')
            }),
            GroupMembership.forPair(user, group).fetch()
              .then(membership => expect(membership).to.exist)
          )
        })
    })

    it('works with linkedin', function () {
      return User.create({
        email: 'foo4@bar.com',
        account: {
          type: 'linkedin',
          profile: {
            id: 'foo',
            photos: [{value: catPic}],
            _json: {
              publicProfileUrl: 'https://www.linkedin.com/in/foobar'
            }
          }
        }
      })
        .then(async (user) => {
          await group.addMembers([user.id])

          expect(user.id).to.exist
          expect(user.get('active')).to.be.true
          expect(user.get('linkedin_url')).to.equal('https://www.linkedin.com/in/foobar')
          expect(user.get('avatar_url')).to.equal(catPic)

          return Promise.join(
            LinkedAccount.where({user_id: user.id}).fetch().then(function (account) {
              expect(account).to.exist
              expect(account.get('provider_key')).to.equal('linkedin')
              expect(account.get('provider_user_id')).to.equal('foo')
            }),
            GroupMembership.forPair(user, group).fetch()
              .then(membership => expect(membership).to.exist)
          )
        })
    })
  })

  describe('#followDefaultTags', function () {
    it('creates TagFollows for the default tags of a group', () => {
      const c1 = factories.group()
      return c1.save()
        .then(() => Tag.forge({ name: 'hello' }).save())
        .then(tag => GroupTag.create({ tag_id: tag.id, group_id: c1.id, is_default: true }))
        .then(() => User.followDefaultTags(cat.id, c1.id))
        .then(() => cat.load('followedTags'))
        .then(() => {
          expect(cat.relations.followedTags.length).to.equal(1)
          const tagNames = cat.relations.followedTags.map(t => t.get('name'))
          expect(tagNames[0]).to.equal('hello')
        })
    })
  })

  describe('.deactivate and .reactivate', () => {
    before(function () {
      User.clearSessionsFor = () => {}
    })

    it('deactivates and reactivates a user', () => {
      return User.create({
        email: 'belle@grace.net',
        account: { type: 'password', password: 'password!' },
        name: 'Belle Graceful'
      })
        .then(async function (user) {
          await user.deactivate('wacca wacca')
          expect(user.get('active')).to.be.false
          await user.reactivate()
          expect(user.get('active')).to.be.true
        })
    })
  })

  describe('.unseenThreadCount', () => {
    let doge, post, post2

    before(async () => {
      doge = factories.user()
      ;[post, post2] = times(2, () => factories.post({ type: Post.Type.THREAD }))

      await doge.save()
      return Promise.map([post, post2], p =>
        p.save().then(() => p.addFollowers([cat.id, doge.id])))
    })

    it('works as expected', async function () {
      this.timeout(5000)

      const addMessages = (p, num = 1, creator = doge) =>
        wait(100)
          .then(() => Promise.all(times(num, () =>
            Comment.forge({
              post_id: p.id,
              user_id: creator.id,
              text: 'arf',
              active: true
            }).save())))
          .then(comments => Post.updateFromNewComment({
            postId: p.id,
            commentId: comments.slice(-1)[0].id
          }))

      const n = await User.unseenThreadCount(cat.id)
      expect(n).to.equal(0)

      // four messages but two threads
      await addMessages(post, 2)
      await addMessages(post2, 2)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(2))
      await User.unseenThreadCount(doge.id).then(n => expect(n).to.equal(0))

      // mark one thread as read
      await post.markAsRead(cat.id)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(1))

      // another new message
      await addMessages(post)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(2))

      // dropdown was opened
      await cat.addSetting({ last_viewed_messages_at: new Date() }, true)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(0))

      // new message after dropdown was opened
      await addMessages(post2)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(1))

      // cat responds
      await addMessages(post, 2, cat)
      await addMessages(post2, 2, cat)
      await User.unseenThreadCount(cat.id).then(n => expect(n).to.equal(0))
      await User.unseenThreadCount(doge.id).then(n => expect(n).to.equal(2))
    })
  })

  describe('.comments', () => {
    beforeEach(() => {
      return factories.post({type: Post.Type.THREAD}).save()
        .then(post => factories.comment({
          post_id: post.id,
          user_id: cat.id
        }).save())
        .then(() => factories.post().save())
        .then(post => factories.comment({
          post_id: post.id,
          user_id: cat.id
        }).save())
    })

    it.skip('does not include messages', () => {
      return cat.comments().fetch()
        .then(comments => expect(comments.length).to.equal(1))
    })
  })

  describe('.gravatar', () => {
    it('handles a blank email', () => {
      expect(User.gravatar(null)).to.equal('https://www.gravatar.com/avatar/d41d8cd98f00b204e9800998ecf8427e?d=mm&s=140')
    })
  })

  describe('#groupsSharedWithUser', () => {
    it('returns shared', async () => {
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      const group1 = await factories.group().save()
      const group2 = await factories.group().save()
      const group3 = await factories.group().save()
      const group4 = await factories.group().save()
      await Promise.join(
        user1.joinGroup(group1),
        user1.joinGroup(group2),
        user1.joinGroup(group3),
        user2.joinGroup(group2),
        user2.joinGroup(group3),
        user2.joinGroup(group4))
      const sharedGroups = await user1.groupsSharedWithUser(user2)
      expect(sharedGroups.length).to.equal(2)
      expect(sharedGroups.map(c => c.id).sort()).to.deep.equal([group2.id, group3.id].sort())
    })
  })

  describe('#intercomHash', () => {
    it('returns an HMAC', async () => {
      const user = await factories.user().save()
      process.env.INTERCOM_KEY = '12345'
      const hash = crypto.createHmac('sha256', process.env.INTERCOM_KEY)
        .update(user.id)
        .digest('hex')
      expect(user.intercomHash()).to.equal(hash)
    })
  })

  describe('#claims', () => {
    let user, location

    before(async () => {
      location = await Location.create({
        address_number: '1',
        address_street: 'Best St',
        city: 'City',
        region: 'Region',
        neighborhood: 'neighborhood',
        postcode: '94610',
        country: 'USA'
      })
      user = await User.create({
        active: true,
        avatar_url: 'https://picture.com/me',
        email: 'sweet@mojo.org',
        email_validated: true,
        location_id: location.id,
        location: 'full location',
        name: 'Mojo'
      })
    })

    it('returns the right data based on scope', async () => {
      expect(await user.claims('userinfo', '')).to.deep.equal({ sub: user.id })
      expect(await user.claims('userinfo', 'email')).to.deep.equal({
        sub: user.id,
        email: user.get('email'),
        email_verified: true
      })
      expect(await user.claims('userinfo', 'email phone address profile')).to.deep.equal({
        sub: user.id,
        email: user.get('email'),
        email_verified: true,
        address: {
          country: location.get('country'),
          formatted: user.get('location'),
          locality: location.get('city'),
          postal_code: location.get('postcode'),
          region: location.get('region'),
          street_address: location.get('address_number') + ' ' + location.get('address_street')
        },
        birthdate: null,
        family_name: null,
        gender: null,
        given_name: null,
        locale: null,
        middle_name: null,
        name: user.get('name'),
        nickname: null,
        picture: user.get('avatar_url'),
        preferred_username: null,
        profile: Frontend.Route.profile(user),
        updated_at: user.get('updated_at'),
        website: null,
        zoneinfo: null,
        phone_number: user.get('contact_phone'),
        phone_number_verified: false
      })
    })
  })

  describe('.createRsvpCalendarSubscription', () => {
    let user, eventOwner, group, event1, event2, event3, eventInactive, eventPastYear, eventOlderThanYear
    let storageModule, calendarContent
    let originalFind

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      eventOwner = await factories.user().save()
      group = await factories.group().save()
      
      // Create calendar_token for user
      try {
        await user.save({ calendar_token: 'test-token-123' }, { patch: true })
      } catch (e) {
        // Column might not exist, store it in a custom property
        user._calendarToken = 'test-token-123'
      }

      // Create events with different dates
      const now = new Date()
      const oneHour = 60 * 60 * 1000
      const futureDate1 = new Date(now.getTime() + oneHour)
      const futureDate2 = new Date(now.getTime() + 2 * oneHour)
      const futureDate3 = new Date(now.getTime() + 3 * oneHour)
      const pastYearDate = Post.eventCalSubDateLimit().plus({ hours: 1 }).toJSDate()
      const olderThanYearDate = Post.eventCalSubDateLimit().minus({ hours: 1 }).toJSDate()

      event1 = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event 1',
        start_time: futureDate1,
        end_time: new Date(futureDate1.getTime() + oneHour)
      }).save()

      event2 = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event 2',
        start_time: futureDate2,
        end_time: new Date(futureDate2.getTime() + oneHour)
      }).save()

      event3 = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event 3',
        start_time: futureDate3,
        end_time: new Date(futureDate3.getTime() + oneHour)
      }).save()

      eventInactive = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: false,
        name: 'Inactive Event',
        start_time: futureDate1,
        end_time: new Date(futureDate1.getTime() + oneHour)
      }).save()

      eventPastYear = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event Past Year',
        start_time: pastYearDate,
        end_time: new Date(pastYearDate.getTime() + oneHour)
      }).save()

      eventOlderThanYear = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event Older Than Year',
        start_time: olderThanYearDate,
        end_time: new Date(olderThanYearDate.getTime() + oneHour)
      }).save()

      await event1.groups().attach([group.id])
      await event2.groups().attach([group.id])
      await event3.groups().attach([group.id])
      await eventInactive.groups().attach([group.id])
      await eventPastYear.groups().attach([group.id])
      await eventOlderThanYear.groups().attach([group.id])

      // Create EventInvitations for user
      await EventInvitation.create({
        userId: user.id,
        eventId: event1.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: event2.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.INTERESTED
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: event3.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventInactive.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventPastYear.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventOlderThanYear.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })

      originalFind = User.find
    })

    beforeEach(async () => {
      calendarContent = null
      // Mock writeStringToS3 to capture calendar content
      storageModule = require(root('lib/uploader/storage'))
      spyify(storageModule, 'writeStringToS3', (content) => {
        calendarContent = content
        return Promise.resolve({ url: 'https://example.com/calendar.ics' })
      })

      // Mock User.find to return user with calendar_token
      const mockUser = await User.find(user.id)
      if (!mockUser.get('calendar_token') && user._calendarToken) {
        const originalGet = mockUser.get.bind(mockUser)
        mockUser.get = function(key) {
          if (key === 'calendar_token') {
            return user._calendarToken
          }
          return originalGet(key)
        }
      }
      User.find = () => Promise.resolve(mockUser)
    })

    afterEach(() => {
      unspyify(storageModule, 'writeStringToS3')
      if (User.find !== originalFind) {
        User.find = originalFind
      }
    })

    it('creates calendar subscription with active events', async () => {
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify active events are included
      expect(calendarContent).to.include(event1.iCalUid())
      expect(calendarContent).to.include(event2.iCalUid())
      expect(calendarContent).to.include(event3.iCalUid())
    })

    it('excludes inactive events', async () => {
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(calendarContent).to.not.include(eventInactive.iCalUid())
    })

    it('excludes deleted (active: false) events from calendar subscription', async () => {
      // Create a new active event with an invitation for the user
      const now = new Date()
      const oneHour = 60 * 60 * 1000
      const futureDate = new Date(now.getTime() + oneHour)
      
      const activeEvent = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event to be Deleted',
        start_time: futureDate,
        end_time: new Date(futureDate.getTime() + oneHour)
      }).save()
      
      await activeEvent.groups().attach([group.id])
      
      await EventInvitation.create({
        userId: user.id,
        eventId: activeEvent.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })

      // First, verify the active event is included
      await User.createRsvpCalendarSubscription({ userId: user.id })
      expect(calendarContent).to.include(activeEvent.iCalUid())

      // Now delete the event (set active: false)
      await activeEvent.save({ active: false }, { patch: true })

      // Regenerate the calendar subscription
      calendarContent = null
      await User.createRsvpCalendarSubscription({ userId: user.id })

      // Verify the deleted event is NOT included
      expect(calendarContent).to.not.include(activeEvent.iCalUid())
      // But other active events should still be included
      expect(calendarContent).to.include(event1.iCalUid())
      expect(calendarContent).to.include(event2.iCalUid())
      expect(calendarContent).to.include(event3.iCalUid())
    })

    it('includes events within the past year (up to one year ago)', async () => {
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(calendarContent).to.include(eventPastYear.iCalUid())
    })

    it('excludes events older than one year', async () => {
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(calendarContent).to.not.include(eventOlderThanYear.iCalUid())
    })

    it('returns early if user does not exist', async () => {
      User.find = () => Promise.resolve(null)
      await User.createRsvpCalendarSubscription({ userId: 99999 })

      expect(storageModule.writeStringToS3).to.not.have.been.called
    })

    it('returns early if user does not have calendar_token', async () => {
      const userWithoutToken = await factories.user().save()
      User.find = () => Promise.resolve(userWithoutToken)
      
      await User.createRsvpCalendarSubscription({ userId: userWithoutToken.id })

      expect(storageModule.writeStringToS3).to.not.have.been.called
    })

    it('includes only events where user responded YES or INTERESTED', async () => {
      // Create events with different RSVP responses
      const now = new Date()
      const oneHour = 60 * 60 * 1000
      const futureDateYes = new Date(now.getTime() + 4 * oneHour)
      const futureDateInterested = new Date(now.getTime() + 5 * oneHour)
      const futureDateNo = new Date(now.getTime() + 6 * oneHour)
      const futureDateNull = new Date(now.getTime() + 7 * oneHour)

      const eventYes = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event YES',
        start_time: futureDateYes,
        end_time: new Date(futureDateYes.getTime() + oneHour)
      }).save()

      const eventInterested = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event INTERESTED',
        start_time: futureDateInterested,
        end_time: new Date(futureDateInterested.getTime() + oneHour)
      }).save()

      const eventNo = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event NO',
        start_time: futureDateNo,
        end_time: new Date(futureDateNo.getTime() + oneHour)
      }).save()

      const eventNull = await factories.post({
        type: Post.Type.EVENT,
        user_id: eventOwner.id,
        active: true,
        name: 'Event NULL',
        start_time: futureDateNull,
        end_time: new Date(futureDateNull.getTime() + oneHour)
      }).save()

      await eventYes.groups().attach([group.id])
      await eventInterested.groups().attach([group.id])
      await eventNo.groups().attach([group.id])
      await eventNull.groups().attach([group.id])

      // Create EventInvitations with different responses
      await EventInvitation.create({
        userId: user.id,
        eventId: eventYes.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.YES
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventInterested.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.INTERESTED
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventNo.id,
        inviterId: eventOwner.id,
        response: EventInvitation.RESPONSE.NO
      })
      await EventInvitation.create({
        userId: user.id,
        eventId: eventNull.id,
        inviterId: eventOwner.id,
        response: null
      })

      // Generate calendar subscription
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist

      // Verify YES and INTERESTED events are included
      expect(calendarContent).to.include(eventYes.iCalUid())
      expect(calendarContent).to.include(eventInterested.iCalUid())

      // Verify NO and NULL response events are NOT included
      expect(calendarContent).to.not.include(eventNo.iCalUid())
      expect(calendarContent).to.not.include(eventNull.iCalUid())
    })

    it('writes calendar to correct S3 path', async () => {
      await User.createRsvpCalendarSubscription({ userId: user.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      const callArgs = storageModule.writeStringToS3.__spy.calls[0]
      const path = callArgs[1]
      const calendarToken = user.get('calendar_token') || user._calendarToken
      expect(path).to.include(`user/${user.id}/calendar-${calendarToken}.ics`)
      expect(callArgs[2].ContentType).to.equal('text/calendar')
    })
  })

  describe('.deleteRsvpCalendarSubscription', () => {
    let user, storageModule
    let originalFind

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      
      // Create calendar_token for user
      try {
        await user.save({ calendar_token: 'test-token-456' }, { patch: true })
      } catch (e) {
        // Column might not exist, store it in a custom property
        user._calendarToken = 'test-token-456'
      }

      originalFind = User.find
    })

    beforeEach(async () => {
      storageModule = require(root('lib/uploader/storage'))
      spyify(storageModule, 'deleteFromS3', () => Promise.resolve())

      // Mock User.find to return user with calendar_token
      const mockUser = await User.find(user.id)
      if (!mockUser.get('calendar_token') && user._calendarToken) {
        const originalGet = mockUser.get.bind(mockUser)
        mockUser.get = function(key) {
          if (key === 'calendar_token') {
            return user._calendarToken
          }
          return originalGet(key)
        }
      }
      User.find = () => Promise.resolve(mockUser)
    })

    afterEach(() => {
      unspyify(storageModule, 'deleteFromS3')
      if (User.find !== originalFind) {
        User.find = originalFind
      }
    })

    it('deletes calendar file from S3', async () => {
      await User.deleteRsvpCalendarSubscription({ userId: user.id })

      expect(storageModule.deleteFromS3).to.have.been.called
    })

    it('deletes calendar from correct S3 path', async () => {
      await User.deleteRsvpCalendarSubscription({ userId: user.id })

      const callArgs = storageModule.deleteFromS3.__spy.calls[0]
      const path = callArgs[0]
      const calendarToken = user.get('calendar_token') || user._calendarToken
      expect(path).to.include(`user/${user.id}/calendar-${calendarToken}.ics`)
    })

    it('returns early if user does not exist', async () => {
      User.find = () => Promise.resolve(null)
      await User.deleteRsvpCalendarSubscription({ userId: 99999 })

      expect(storageModule.deleteFromS3).to.not.have.been.called
    })
  })
})
