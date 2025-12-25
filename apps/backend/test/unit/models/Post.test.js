/* eslint-disable no-unused-expressions */
import { expect } from 'chai'
import setup from '../../setup'
import factories from '../../setup/factories'
import { spyify, unspyify } from '../../setup/helpers'

describe('Post', function () {
  describe('#addFollowers', function () {
    let u1, u2, post

    beforeEach(async () => {
      await setup.clearDb()
      u1 = await factories.user().save()
      u2 = await factories.user().save()
      post = await factories.post({user_id: u1.id}).save()
    })

    it('adds a follower, ignoring duplicates', async () => {
      await post.addFollowers([u2.id])

      let followers = await post.followers().fetch()
      expect(followers.length).to.equal(1)
      const follower = followers.first()
      expect(follower.id).to.equal(u2.id)

      await post.addFollowers([u2.id, u1.id])

      followers = await post.followers().fetch()
      expect(followers.length).to.equal(2)
    })

    it('queries for lastReadAt correctly', async () => {
      await post.addFollowers([u1.id])

      expect((await post.lastReadAtForUser(u1.id)).getTime()).to.be.closeTo(new Date(0).getTime(), 2000)
      await post.markAsRead(u1.id)
      expect((await post.lastReadAtForUser(u1.id)).getTime()).to.be.closeTo(new Date().getTime(), 2000)
    })
  })

  describe('#getCommenters', function () {
    var u1, u2, u3, u4, u5, u6, u7, u8, post

    before(() => {
      return setup.clearDb().then(function () {
        u1 = new User({email: 'a@post.c'})
        u2 = new User({email: 'b@post.b'})
        u3 = new User({email: 'c@post.c'})
        u4 = new User({email: 'd@post.d'})
        u5 = new User({email: 'e@post.e'})
        u6 = new User({email: 'f@post.f'})
        u7 = new User({email: 'g@post.g'})
        u8 = new User({email: 'h@post.h'})
        post = new Post()
        return Promise.join(
          u1.save(),
          u2.save(),
          u3.save(),
          u4.save(),
          u5.save(),
          u6.save(),
          u7.save(),
          u8.save()
        ).then(function () {
          post.set('user_id', u1.id)
          return post.save()
        }).then(function () {
          return Promise.map([u1, u2, u3, u4, u5, u6, u7, u8], (u) => {
            const c = new Comment({
              user_id: u.id,
              post_id: post.id,
              active: true
            })
            return c.save()
          })
        })
      })
    })

    it('includes the current user always, regardless of when they commented', function () {
      return Promise.join(
        post.getCommenters(1, u1.id).then(function (results) {
          expect(results.length).to.equal(1)
          expect(results._byId[u1.id]).to.not.be.undefined
        }),
        post.getCommenters(1, u2.id).then(function (results) {
          expect(results.length).to.equal(1)
          expect(results._byId[u2.id]).to.not.be.undefined
        }),
        post.getCommenters(3, u1.id).then(function (results) {
          expect(results.length).to.equal(3)
          expect(results._byId[u1.id]).to.not.be.undefined
        }),
        post.getCommenters(3, u2.id).then(function (results) {
          expect(results.length).to.equal(3)
          expect(results._byId[u2.id]).to.not.be.undefined
        })
      )
    })
  })

  describe('#isVisibleToUser', () => {
    var post, g1, g2, user

    beforeEach(() => {
      post = new Post({name: 'hello', active: true})
      user = factories.user({name: 'Cat'})
      g1 = factories.group({active: true})
      g2 = factories.group({active: true})
      return Promise.join(post.save(), user.save(), g1.save(), g2.save())
      .then(() => user.joinGroup(g1))
      .then(() => post.groups().attach(g2.id))
    })

    it('is true if the post is public', () => {
      return post.save({ is_public: true }, { patch: true })
      .then(() => Post.isVisibleToUser(post.id, user.id))
      .then(visible => expect(visible).to.be.true)
    })

    it('is false if the user is not connected by group', () => {
      return Post.isVisibleToUser(post.id, user.id)
      .then(visible => expect(visible).to.be.false)
    })

    it('is true if the user and post share a group', () => {
      return g2.addMembers([user.id])
      .then(() => Post.isVisibleToUser(post.id, user.id))
      .then(visible => expect(visible).to.be.true)
    })

    it("is false if the user has a disabled membership in the post's group", async () => {
      await g2.addMembers([user.id])
      await g2.removeMembers([user.id])
      const visible = await Post.isVisibleToUser(post.id, user.id)
      expect(visible).to.be.false
    })

    it('is true if the user is following the post', () => {
      return post.addFollowers([user.id])
      .then(() => Post.isVisibleToUser(post.id, user.id))
      .then(visible => expect(visible).to.be.true)
    })
  })

  describe('.createdInTimeRange', () => {
    var post

    before(() => {
      post = new Post({
        name: 'foo',
        created_at: new Date(),
        active: true
      })
      return post.save()
    })

    it('works', () => {
      var now = new Date()
      return Post.createdInTimeRange(new Date(now - 10000), now).query(q => q.orderBy('id', 'desc'))
      .fetch().then(p => {
        expect(p).to.exist
        expect(p.id).to.equal(post.id)
      })
    })
  })

  describe('.copy', () => {
    var post

    before(() => {
      post = factories.post()
      return post.save()
    })

    it('creates a copy of the post with changed attributes', () => {
      var p2 = post.copy({
        description: 'foo'
      })

      return p2.save()
      .then(() => {
        expect(p2.id).to.exist
        expect(p2.id).not.to.equal(post.id)
        expect(p2.details()).to.equal('foo')
        expect(p2.get('name')).to.equal(post.get('name'))
      })
    })
  })

  describe('.deactivate', () => {
    var post

    beforeEach(async () => {
      post = await factories.post().save()
      const activity = await new Activity({post_id: post.id}).save()
      await new Notification({activity_id: activity.id}).save()
      const comment = await factories.comment({post_id: post.id}).save()
      const activity2 = new Activity({comment_id: comment.id}).save()
      await new Notification({activity_id: activity2.id}).save()
    })

    it('handles notifications, comments, activity', async () => {
      await Post.deactivate(post.id)
      await post.refresh()
      await post.load([
        'comments',
        'activities',
        'activities.notifications',
        'comments.activities',
        'comments.activities.notifications'
      ])
      expect(post.relations.activities.length).to.equal(0)
      expect(post.relations.comments.first().activities.length).to.equal(0)
      expect(post.get('active')).to.be.false
    })
  })

  describe('.createActivities', () => {
    let u, u2, u3, c

    before(async () => {
      u = await factories.user().save()
      u2 = await factories.user().save()
      u3 = await factories.user().save()
      c = await factories.group().save()
      await u2.joinGroup(c)
      await u3.joinGroup(c)
    })

    it('creates activity for group members', () => {
      const post = factories.post({user_id: u.id})

      return post.save()
        .then(() => post.groups().attach(c.id))
        .then(() => post.createActivities())
        .then(() => Activity.where({post_id: post.id}).fetchAll())
        .then(activities => {
          expect(activities.length).to.equal(2)
          expect(activities.pluck('reader_id').sort()).to.deep.equal([u2.id, u3.id].sort())
          activities.forEach(activity => {
            expect(activity.get('actor_id')).to.equal(u.id)
            expect(activity.get('meta')).to.deep.equal({reasons: [`newPost: ${c.id}`]})
            expect(activity.get('unread')).to.equal(true)
          })
        })
    })

    it('creates an activity for a mention', () => {
      const post = factories.post({
        user_id: u.id,
        description: `<p>Yo <a class="mention" data-type="mention" data-id="${u3.id}" data-label="u3">u3</a>, how goes it</p>`
      })

      return post.save()
        .then(() => post.groups().attach(c.id))
        .then(() => post.createActivities())
        .then(() => Activity.where({post_id: post.id, reader_id: u3.id}).fetchAll())
        .then(activities => {
          expect(activities.length).to.equal(1)
          const activity = activities.first()
          expect(activity).to.exist
          expect(activity.get('actor_id')).to.equal(u.id)
          expect(activity.get('meta')).to.deep.equal({reasons: ['mention', `newPost: ${c.id}`]})
          expect(activity.get('unread')).to.equal(true)
        })
    })

    it('creates an activity for a tag follower', () => {
      const post = factories.post({
        user_id: u.id
      })

      return new Tag({name: 'FollowThisTag'}).save()
        .tap(tag => u3.followedTags().attach({tag_id: tag.id, group_id: c.id}))
        .then(() => post.save())
        .then(() => Tag.updateForPost(post, ['FollowThisTag']))
        .then(() => post.groups().attach(c.id))
        .then(() => post.createActivities())
        .then(() => Activity.where({post_id: post.id, reader_id: u3.id}).fetchAll())
        .then(activities => {
          expect(activities.length).to.equal(1)
          const activity = activities.first()
          expect(activity).to.exist
          expect(activity.get('actor_id')).to.equal(u.id)
          expect(activity.get('meta')).to.deep.equal({reasons: [`newPost: ${c.id}`, 'tag: FollowThisTag']})
          expect(activity.get('unread')).to.equal(true)
        })
    })
  })

  describe('#updateFromNewComment', () => {
    let post, user

    before(async () => {
      user = await factories.user().save()
      post = await factories.post().save()
      await post.addFollowers([user.id])
    })

    it('updates several attributes', async () => {
      const comment = factories.comment({
        post_id: post.id,
        created_at: new Date(),
        user_id: user.id
      })

      await comment.save()
      await Post.updateFromNewComment({postId: post.id, commentId: comment.id})
      await post.refresh()
      expect(post.get('num_comments')).to.equal(1)

      const timestamps = [
        post.get('updated_at'),
        await post.lastReadAtForUser(user.id)
      ]
      const now = new Date().getTime()
      for (const date of timestamps) {
        expect(date.getTime()).to.be.closeTo(now, 2000)
      }
    })
  })

  describe('reactions', () => {
    let user, post

    before(async () => {
      user = await factories.user().save()
      post = await factories.post().save()
      await post.addFollowers([user.id])
    })

    it('adds new reactions and updates counts correctly', async () => {
      await post.addReaction(user.id, '\uD83D\uDC4D')
      await post.addReaction(user.id, '😁')
      await post.refresh()
      const reactions = await post.reactions().fetch()
      expect(reactions.length).to.equal(2)
      expect(reactions.pluck('user_id')).to.deep.equal([user.id, user.id])
      expect(reactions.pluck('emoji_full')).to.deep.equal(['\uD83D\uDC4D', '😁'])
      expect(post.get('num_people_reacts')).to.equal(1)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 1, '😁': 1 })
    })

    it('deletes reactions correctly', async () => {
      await post.deleteReaction(user.id, '\uD83D\uDC4D')
      expect(post.get('num_people_reacts')).to.equal(1)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 0, '😁': 1 })
      await post.deleteReaction(user.id, '\uD83D\uDC4D')
      expect(post.get('num_people_reacts')).to.equal(1)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 0, '😁': 1 })
      await post.deleteReaction(user.id, '😁')
      expect(post.get('num_people_reacts')).to.equal(0)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 0, '😁': 0 })
    })

    it('votes correctly and not too many times', async () => {
      await post.vote(user.id, true)
      await post.vote(user.id, true)
      expect(post.get('num_people_reacts')).to.equal(1)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 1, '😁': 0 })
      await post.vote(user.id, false)
      await post.vote(user.id, false)
      expect(post.get('num_people_reacts')).to.equal(0)
      expect(post.get('reactions_summary')).to.deep.equal({ '👍': 0, '😁': 0 })
    })
  })

  describe('#unreadCountForUser', () => {
    let post, user, user2

    before(async () => {
      post = factories.post()
      user = factories.user()
      user2 = factories.user()
      await Promise.join(post.save(), user.save(), user2.save())

      const lastReadDate = new Date()
      const earlier = new Date(lastReadDate.getTime() - 60000)
      const later = new Date(lastReadDate.getTime() + 60000)
      await factories.comment({post_id: post.id, created_at: earlier}).save()
      await factories.comment({post_id: post.id, created_at: later}).save()
      await factories.comment({post_id: post.id, created_at: later}).save()

      await post.addFollowers([user.id])
      await post.markAsRead(user.id)
      return post.save({ updated_at: later }, {patch: true})
    })

    it('returns the number of unread messages (comments)', () => {
      return post.unreadCountForUser(user.id)
        .then(count => expect(count).to.equal(2))
    })

    it('returns the total number of messages (comments) with no read timestamps', () => {
      return post.unreadCountForUser(user2.id)
        .then(count => expect(count).to.equal(3))
    })
  })

  describe('.processEventCreated', () => {
    let user, post, eventInviteeIds, params, eventInvitation
    let originalFind

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      post = await factories.post({
        user_id: user.id,
        type: Post.Type.EVENT
      }).save()
      eventInviteeIds = []
      params = {}
      originalFind = Post.find
    })

    beforeEach(() => {
      eventInvitation = {
        id: 123,
        get: () => {},
        incrementIcalSequence: () => Promise.resolve()
      }
      spyify(EventInvitation, 'create', () => Promise.resolve(eventInvitation))
    })

    afterEach(() => {
      unspyify(EventInvitation, 'create')
      if (Post.find !== originalFind) {
        Post.find = originalFind
      }
    })

    it('creates EventInvitation with correct parameters', async () => {
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvp = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscription = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds,
        userId: user.id,
        params
      })

      expect(EventInvitation.create).to.have.been.called
      expect(EventInvitation.create).to.have.been.called.with({
        userId: user.id,
        eventId: post.id,
        inviterId: user.id,
        response: EventInvitation.RESPONSE.YES
      })
    })

    it('calls updateEventInvitees with correct arguments', async () => {
      const updateEventInviteesSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = updateEventInviteesSpy
      postInstance.sendUserRsvp = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscription = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds: [1, 2, 3],
        userId: user.id,
        params: { location: 'Test Location' }
      })

      expect(updateEventInviteesSpy).to.have.been.called
      expect(updateEventInviteesSpy).to.have.been.called.with({
        eventInviteeIds: [1, 2, 3],
        params: { location: 'Test Location' }
      })
    })

    it('calls sendUserRsvp with correct arguments', async () => {
      const sendUserRsvpSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvp = sendUserRsvpSpy
      postInstance.createUserRsvpCalendarSubscription = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds,
        userId: user.id,
        params
      })

      expect(sendUserRsvpSpy).to.have.been.called
      expect(sendUserRsvpSpy).to.have.been.called.with({
        eventInvitationId: eventInvitation.id,
        eventChanges: { new: true }
      })
    })

    it('calls createUserRsvpCalendarSubscription with correct arguments', async () => {
      const createUserRsvpCalendarSubscriptionSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvp = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscription = createUserRsvpCalendarSubscriptionSpy
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds,
        userId: user.id,
        params
      })

      expect(createUserRsvpCalendarSubscriptionSpy).to.have.been.called
      expect(createUserRsvpCalendarSubscriptionSpy).to.have.been.called.with({
        userId: user.id
      })
    })

    it('calls createGroupEventCalendarSubscriptions with correct arguments', async () => {
      const createGroupEventCalendarSubscriptionsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvp = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscription = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = createGroupEventCalendarSubscriptionsSpy
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds,
        userId: user.id,
        params
      })

      expect(createGroupEventCalendarSubscriptionsSpy).to.have.been.called
    })

    it('returns early if post is not found', async () => {
      Post.find = spy(() => Promise.resolve(null))

      await Post.processEventCreated({
        postId: 99999,
        eventInviteeIds,
        userId: user.id,
        params
      })

      expect(EventInvitation.create).to.not.have.been.called
    })

    it('calls all post methods in correct order', async () => {
      const callOrder = []
      const postInstance = await Post.find(post.id)
      
      postInstance.updateEventInvitees = spy(async () => {
        callOrder.push('updateEventInvitees')
      })
      postInstance.sendUserRsvp = spy(async () => {
        callOrder.push('sendUserRsvp')
      })
      postInstance.createUserRsvpCalendarSubscription = spy(async () => {
        callOrder.push('createUserRsvpCalendarSubscription')
      })
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {
        callOrder.push('createGroupEventCalendarSubscriptions')
      })
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventCreated({
        postId: post.id,
        eventInviteeIds: [1, 2],
        userId: user.id,
        params: { location: 'Test' }
      })

      expect(callOrder).to.deep.equal([
        'updateEventInvitees',
        'createUserRsvpCalendarSubscription',
        'createGroupEventCalendarSubscriptions',
        'sendUserRsvp'
      ])
    })
  })

  describe('.processEventUpdated', () => {
    let user, post, eventInviteeIds, eventChanges
    let originalFind

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      post = await factories.post({
        user_id: user.id,
        type: Post.Type.EVENT
      }).save()
      eventInviteeIds = []
      eventChanges = {}
      originalFind = Post.find
    })

    afterEach(() => {
      if (Post.find !== originalFind) {
        Post.find = originalFind
      }
    })

    it('calls updateEventInvitees with correct arguments', async () => {
      const updateEventInviteesSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = updateEventInviteesSpy
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [1, 2, 3],
        eventChanges: {}
      })

      expect(updateEventInviteesSpy).to.have.been.called
      expect(updateEventInviteesSpy).to.have.been.called.with({
        eventInviteeIds: [1, 2, 3]
      })
    })

    it('skips sending RSVPs if no significant changes', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = sendUserRsvpsSpy
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [],
        eventChanges: {}
      })

      expect(sendUserRsvpsSpy).to.not.have.been.called
    })

    it('calls sendUserRsvps when start_time changes', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = sendUserRsvpsSpy
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      const changes = { start_time: new Date() }
      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [],
        eventChanges: changes
      })

      expect(sendUserRsvpsSpy).to.have.been.called
      expect(sendUserRsvpsSpy).to.have.been.called.with({ eventChanges: changes })
    })

    it('calls sendUserRsvps when end_time changes', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = sendUserRsvpsSpy
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      const changes = { end_time: new Date() }
      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [],
        eventChanges: changes
      })

      expect(sendUserRsvpsSpy).to.have.been.called
      expect(sendUserRsvpsSpy).to.have.been.called.with({ eventChanges: changes })
    })

    it('calls sendUserRsvps when location changes', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = sendUserRsvpsSpy
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      const changes = { location: 'New Location' }
      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [],
        eventChanges: changes
      })

      expect(sendUserRsvpsSpy).to.have.been.called
      expect(sendUserRsvpsSpy).to.have.been.called.with({ eventChanges: changes })
    })

    it('calls createUserRsvpCalendarSubscriptions', async () => {
      const createUserRsvpCalendarSubscriptionsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscriptions = createUserRsvpCalendarSubscriptionsSpy
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [],
        eventChanges: {}
      })

      expect(createUserRsvpCalendarSubscriptionsSpy).to.have.been.called
    })

    it('calls createGroupEventCalendarSubscriptions', async () => {
      const createGroupEventCalendarSubscriptionsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.updateEventInvitees = spy(async () => {})
      postInstance.sendUserRsvps = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = createGroupEventCalendarSubscriptionsSpy
      Post.find = spy(() => Promise.resolve(postInstance))

      expect(createGroupEventCalendarSubscriptionsSpy).to.have.been.called
    })

    it('returns early if post is not found', async () => {
      const updateEventInviteesSpy = spy(async () => {})
      Post.find = spy(() => Promise.resolve(null))

      await Post.processEventUpdated({
        postId: 99999,
        eventInviteeIds: [],
        eventChanges: { start_time: new Date() }
      })

      expect(updateEventInviteesSpy).to.not.have.been.called
    })

    it('calls all post methods in correct order when significant change occur', async () => {
      const callOrder = []
      const postInstance = await Post.find(post.id)
      
      postInstance.updateEventInvitees = spy(async () => {
        callOrder.push('updateEventInvitees')
      })
      postInstance.sendUserRsvps = spy(async () => {
        callOrder.push('sendUserRsvps')
      })
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {
        callOrder.push('createUserRsvpCalendarSubscriptions')
      })
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {
        callOrder.push('createGroupEventCalendarSubscriptions')
      })
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventUpdated({
        postId: post.id,
        eventInviteeIds: [1, 2],
        eventChanges: { start_time: new Date() }
      })

      expect(callOrder).to.deep.equal([
        'updateEventInvitees',
        'createUserRsvpCalendarSubscriptions',
        'createGroupEventCalendarSubscriptions',
        'sendUserRsvps'
      ])
    })
  })

  describe('.processEventDeleted', () => {
    let user, post
    let originalFind

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      post = await factories.post({
        user_id: user.id,
        type: Post.Type.EVENT
      }).save()
      originalFind = Post.find
    })

    afterEach(() => {
      if (Post.find !== originalFind) {
        Post.find = originalFind
      }
    })

    it('calls sendUserRsvps with deleted eventChanges', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.sendUserRsvps = sendUserRsvpsSpy
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventDeleted({
        postId: post.id
      })

      expect(sendUserRsvpsSpy).to.have.been.called
      expect(sendUserRsvpsSpy).to.have.been.called.with({
        eventChanges: { deleted: true }
      })
    })

    it('calls createUserRsvpCalendarSubscriptions', async () => {
      const createUserRsvpCalendarSubscriptionsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.sendUserRsvps = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscriptions = createUserRsvpCalendarSubscriptionsSpy
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {})
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventDeleted({
        postId: post.id
      })

      expect(createUserRsvpCalendarSubscriptionsSpy).to.have.been.called
    })

    it('calls createGroupEventCalendarSubscriptions', async () => {
      const createGroupEventCalendarSubscriptionsSpy = spy(async () => {})
      const postInstance = await Post.find(post.id)
      postInstance.sendUserRsvps = spy(async () => {})
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {})
      postInstance.createGroupEventCalendarSubscriptions = createGroupEventCalendarSubscriptionsSpy
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventDeleted({
        postId: post.id
      })

      expect(createGroupEventCalendarSubscriptionsSpy).to.have.been.called
    })

    it('returns early if post is not found', async () => {
      const sendUserRsvpsSpy = spy(async () => {})
      Post.find = spy(() => Promise.resolve(null))

      await Post.processEventDeleted({
        postId: 99999
      })

      expect(sendUserRsvpsSpy).to.not.have.been.called
    })

    it('calls all post methods in correct order', async () => {
      const callOrder = []
      const postInstance = await Post.find(post.id)
      
      postInstance.sendUserRsvps = spy(async () => {
        callOrder.push('sendUserRsvps')
      })
      postInstance.createUserRsvpCalendarSubscriptions = spy(async () => {
        callOrder.push('createUserRsvpCalendarSubscriptions')
      })
      postInstance.createGroupEventCalendarSubscriptions = spy(async () => {
        callOrder.push('createGroupEventCalendarSubscriptions')
      })
      Post.find = spy(() => Promise.resolve(postInstance))

      await Post.processEventDeleted({
        postId: post.id
      })

      expect(callOrder).to.deep.equal([
        'createUserRsvpCalendarSubscriptions',
        'createGroupEventCalendarSubscriptions',
        'sendUserRsvps'
      ])
    })
  })
})
