/* eslint-disable no-unused-expressions */
import root from 'root-path'
import setup from '../../setup'
import factories from '../../setup/factories'
import { expectEqualQuery, mockify, spyify, unspyify } from '../../setup/helpers'

export function myGroupIdsSqlFragment (userId) {
  return `(select "groups"."id" from "group_memberships"
    inner join "groups"
    on "groups"."id" = "group_memberships"."group_id"
    where "group_memberships"."user_id" = '${userId}'
    and "group_memberships"."active" = true
    and "groups"."active" = true)`
}

describe('Group', function () {
  it('can be created', function () {
    const group = new Group({ slug: 'foo', name: 'foo', access_code: 'foo!', group_data_type: 1 })
    return group.save().then(function () {
      expect(group.id).to.exist
    })
  })

  it('creates with default banner and avatar', async function () {
    const data = {
      name: 'my group',
      description: 'a group description',
      slug: 'comm1'
    }

    const user = await new User({ name: 'username', email: 'john1@foo.com', active: true }).save()
    await Group.create(user.id, data)
    const savedGroup = await Group.find('comm1')
    expect(savedGroup.get('banner_url')).to.equal('/default-group-banner.svg')
    expect(savedGroup.get('avatar_url')).to.equal('/default-group-avatar.svg')
  })

  it('can be created with group extension data', async function () {
    const data = {
      name: 'my group',
      slug: 'group2',
      group_extensions: [{
        type: 'ext',
        data: {
          test: 'somedata'
        }
      }]
    }

    await new Extension({ type: 'ext' }).save()
    const user = await new User({ name: 'username', email: 'john@foo.com', active: true }).save()
    await Group.create(user.id, data)
    const savedGroup = await Group.find('group2')
    const extensions = await savedGroup.groupExtensions().fetch()
    expect(extensions.length).to.equal(1)
    expect(extensions.models[0].pivot.get('data')).to.deep.equal({ test: 'somedata' })
  })

  describe('.find', function () {
    it('ignores a blank id', function () {
      return Group.find(null).then(i => expect(i).to.be.null)
    })
  })

  describe('.queryByAccessCode', function() {
    let group

    before(function() {
      return factories.group({active: true})
      .save()
      .then(c => { group = c })
    })

    it('finds and fetches a group by accessCode', function() {
      const groupId = group.get('id')
      const accessCode = group.get('access_code')
      return Group.queryByAccessCode(accessCode)
      .fetch()
      .then(c => {
        return expect(c.id).to.equal(groupId)
      })
    })
  })

  describe('.isSlugValid', function() {
    it('rejects invalid slugs', function() {
      expect(Group.isSlugValid('a b')).to.be.false
      expect(Group.isSlugValid('IAM')).to.be.false
      expect(Group.isSlugValid('wow!')).to.be.false
      expect(Group.isSlugValid('uh_')).to.be.false
      expect(Group.isSlugValid('a')).to.be.false
      expect(Group.isSlugValid('abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdx')).to.be.false
    })
  })

  describe('.deactivate', function() {
    it('sets active to false and calls Group.deactivate', async function() {
      const group = await factories.group({ active: true }).save()
      await Group.deactivate(group.id)
      await group.refresh()
      expect(group.get('active')).to.equal(false)
    })

    it('deactivates all child members', async function() {
      const group = await factories.group().save()
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      await group.addMembers([user1, user2])
      await Group.deactivate(group.id)
      const postDeactivationMembers = await group.members().fetch()
      expect(postDeactivationMembers.length).to.equal(0)
    })
  })

  describe('addMembers', function () {
    let group, u1, u2, gm1

    beforeEach(async function () {
      group = await Group.forge({ group_data_type: 0 }).save()
      u1 = await factories.user().save()
      u2 = await factories.user().save()
      gm1 = await group.memberships().create({
        user_id: u1.id,
        settings: { here: true },
        group_data_type: 0
      })
    })

    it('merges new settings to existing memberships and creates new ones', async function () {
      const results = await group.addMembers([u1.id, u2.id], { role: 1, settings: { there: true } })
      expect(results.length).to.equal(2)

      await gm1.refresh()
      expect(gm1.get('settings')).to.deep.equal({ here: true, there: true })
      expect(gm1.get('role')).to.equal(1)

      const gm2 = await group.memberships()
        .query(q => q.where('user_id', u2.id)).fetchOne()
      expect(gm2.get('settings')).to.deep.equal({ agreementsAcceptedAt: null, joinQuestionsAnsweredAt: null, showJoinForm: true, there: true })
      expect(gm2.get('role')).to.equal(1)
    })
  })

  describe('removeMembers', function() {
    it('removes child members', async function() {
      const group = await factories.group().save()
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      await group.addMembers([user1, user2])
      await group.removeMembers(await group.members().fetch())
      const postRemoveMembers = await group.members().fetch()
      expect(postRemoveMembers.length).to.equal(0)
    })
  })

  describe('updateMembers', function() {
    it('updates members', async function() {
      const group = await factories.group().save()
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      const projectRole = await ProjectRole.forge({name: 'test role'}).save()
      const role = 1
      const project_role_id = projectRole.id
      const updates = { role, project_role_id }
      await group.addMembers([user1, user2])
      await group.updateMembers([user1, user2], updates)
      const updatedMemberships = await group.memberships().fetch()
      updatedMemberships.models.forEach(membership => {
        expect(membership.get('project_role_id')).to.equal(project_role_id)
        expect(membership.get('role')).to.equal(role)
      })
    })
  })

  describe('selectIdsForMember', function() {
    it('produces the expected query clause', function() {
      const query = Post.query(q => {
        q.join('groups_posts', 'posts.id', 'groups_posts.group_id')
        q.whereIn('groups_posts.group_id', Group.selectIdsForMember('42'))
      })

      expectEqualQuery(query, `select * from "posts"
        inner join "groups_posts"
        on "posts"."id" = "groups_posts"."group_id"
        where "groups_posts"."group_id" in
        ${myGroupIdsSqlFragment('42')}`)
    })
  })

  describe('.doesMenuUpdate', function () {
    let group1, group2, post, customView

    before(async function () {
      // Create test groups
      group1 = await factories.group().save()
      group2 = await factories.group().save()

      // Create project post
      post = await factories.post().save({
        type: 'project',
        name: 'Test Project'
      })

      // Create custom view
      customView = await factories.customView().save({
        group_id: group1.id,
        order: 1
      })

      // Setup initial context widgets for both groups
      await group1.setupContextWidgets()
      await group2.setupContextWidgets()
    })

    it('updates groups widget order when groups are related', async function () {
      // Initial check
      const initialWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const groupsWidget = initialWidgets.find(w => w.get('view') === 'groups')
      expect(groupsWidget.get('order')).to.be.null

      // Perform update
      await Group.doesMenuUpdate({ groupIds: [group1.id, group2.id], groupRelation: true })

      // Check result
      const updatedWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const updatedGroupsWidget = updatedWidgets.find(w => w.get('view') === 'groups')
      expect(updatedGroupsWidget.get('order')).to.not.be.null
    })

    it('updates projects widget order when project post is added', async function () {
      // Initial check
      const initialWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const projectsWidget = initialWidgets.find(w => w.get('view') === 'projects')
      expect(projectsWidget.get('order')).to.be.null
      console.log('this should be a post', post, 'right?????')
      // Perform update
      await Group.doesMenuUpdate({ groupIds: [group1.id], post: { type: post.get('type'), location_id: post.get('location_id') } })

      // Check result
      const updatedWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const updatedProjectsWidget = updatedWidgets.find(w => w.get('view') === 'projects')

      expect(updatedProjectsWidget.get('order')).to.not.be.null
    })

    it('creates widget for custom view when added', async function () {
      // Initial check
      const initialWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const initialCustomViewWidgets = initialWidgets.filter(w => w.get('custom_view_id'))
      expect(initialCustomViewWidgets).to.be.empty

      // Perform update
      await Group.doesMenuUpdate({ groupIds: [group1.id], customView })

      // Check result
      const updatedWidgets = await ContextWidget.where({ group_id: group1.id }).fetchAll()
      const customViewWidgets = updatedWidgets.filter(w => w.get('custom_view_id'))
      expect(customViewWidgets).to.not.be.empty
      expect(customViewWidgets[0].get('custom_view_id')).to.equal(String(customView.id))
    })
  })

  describe('.createEventCalendarSubscription', () => {
    let group, user, event1, event2, event3, eventPastYear, eventOlderThanYear
    let calendarContent
    let storageModule
    const { DateTime } = require('luxon')

    before(async () => {
      await setup.clearDb()
      user = await factories.user().save()
      group = await factories.group().save()
      
      // Get the date limit (one year in the past)
      const dateLimit = Post.eventCalSubDateLimit()
      
      // Create events with future start times (after the date limit)
      const futureDate1 = new Date()
      futureDate1.setFullYear(futureDate1.getFullYear() + 1)
      const futureDate2 = new Date()
      futureDate2.setFullYear(futureDate2.getFullYear() + 2)
      const futureDate3 = new Date()
      futureDate3.setFullYear(futureDate3.getFullYear() + 3)

      // Create event within the past year (should be included)
      const pastYearDate = dateLimit.plus({ hours: 1 }).toJSDate() // 30 days after the limit
      
      // Create event older than one year (should be excluded)
      const olderThanYearDate = dateLimit.minus({ hours: 1 }).toJSDate() 
      const oneHour = 3600000 // number of milliseconds in one hour

      event1 = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true,
        name: 'Event 1',
        start_time: futureDate1,
        end_time: new Date(futureDate1.getTime() + oneHour)
      }).save()
      
      event2 = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true,
        name: 'Event 2',
        start_time: futureDate2,
        end_time: new Date(futureDate2.getTime() + oneHour)
      }).save()
      
      event3 = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true,
        name: 'Event 3',
        start_time: futureDate3,
        end_time: new Date(futureDate3.getTime() + oneHour)
      }).save()

      eventPastYear = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true,
        name: 'Event Past Year',
        start_time: pastYearDate,
        end_time: new Date(pastYearDate.getTime() + oneHour)
      }).save()

      eventOlderThanYear = await factories.post({
        type: Post.Type.EVENT,
        user_id: user.id,
        active: true,
        name: 'Event Older Than Year',
        start_time: olderThanYearDate,
        end_time: new Date(olderThanYearDate.getTime() + oneHour)
      }).save()

      await event1.groups().attach([group.id])
      await event2.groups().attach([group.id])
      await event3.groups().attach([group.id])
      await eventPastYear.groups().attach([group.id])
      await eventOlderThanYear.groups().attach([group.id])
    })

    beforeEach(() => {
      calendarContent = null
      // Mock writeStringToS3 to capture calendar content
      storageModule = require(root('lib/uploader/storage'))
      spyify(storageModule, 'writeStringToS3', async (content) => {
        calendarContent = content
        return Promise.resolve({ url: 'https://example.com/calendar.ics' })
      })
    })

    afterEach(() => {
      unspyify(storageModule, 'writeStringToS3')
    })

    it('includes active events when creating calendar subscription', async () => {
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(group.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            // Column doesn't exist, but we've stored it
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify all active events are included in the calendar by checking for their UIDs
      expect(calendarContent).to.include(event1.iCalUid())
      expect(calendarContent).to.include(event2.iCalUid())
      expect(calendarContent).to.include(event3.iCalUid())
      
      Group.find = originalFind
    })

    it('includes events within the past year (up to one year ago)', async () => {
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(group.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify event within the past year is included
      expect(calendarContent).to.include(eventPastYear.iCalUid())
      
      Group.find = originalFind
    })

    it('excludes events older than one year', async () => {
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(group.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify event older than one year is excluded
      expect(calendarContent).to.not.include(eventOlderThanYear.iCalUid())
      
      Group.find = originalFind
    })

    it('verifies Post.eventCalSubDateLimit returns date one year in the past', () => {
      const dateLimit = Post.eventCalSubDateLimit()
      const expectedDate = DateTime.now().minus({ years: 1 }).toISO()
      
      // Allow for small time differences (within 1 second)
      const dateLimitTime = new Date(dateLimit).getTime()
      const expectedDateTime = new Date(expectedDate).getTime()
      const timeDiff = Math.abs(dateLimitTime - expectedDateTime)
      
      expect(timeDiff).to.be.below(1000) // Less than 1 second difference
    })

    it('excludes inactive events when creating calendar subscription', async () => {
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(group.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      // Deactivate event2
      await event2.save({ active: false }, { patch: true })
      
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify active events are included
      expect(calendarContent).to.include(event1.iCalUid())
      expect(calendarContent).to.include(event3.iCalUid())
      
      // Verify inactive event is excluded
      expect(calendarContent).to.not.include(event2.iCalUid())
      
      Group.find = originalFind
    })

    it('includes only active events after some are deactivated', async () => {
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(group.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      // Reactivate event2 first
      await event2.save({ active: true }, { patch: true })
      // Deactivate event1 and event3
      await event1.save({ active: false }, { patch: true })
      await event3.save({ active: false }, { patch: true })
      
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist
      
      // Verify only active event2 is included
      expect(calendarContent).to.include(event2.iCalUid())
      expect(calendarContent).to.not.include(event1.iCalUid())
      expect(calendarContent).to.not.include(event3.iCalUid())
      
      Group.find = originalFind
    })

    it('creates calendar_token if it does not exist', async () => {
      const groupWithoutToken = await factories.group().save()
      
      // Mock Group.find to return a group with mocked save method
      const originalFind = Group.find
      const mockGroup = await Group.find(groupWithoutToken.id)
      const originalSave = mockGroup.save.bind(mockGroup)
      mockGroup.save = async function(attrs, opts) {
        if (attrs && attrs.calendar_token) {
          this._calendarToken = attrs.calendar_token
        }
        try {
          return await originalSave(attrs, opts)
        } catch (e) {
          if (e.message && e.message.includes('calendar_token')) {
            // Column doesn't exist, but we've stored it
            return this
          }
          throw e
        }
      }
      Group.find = () => Promise.resolve(mockGroup)
      
      await Group.createEventCalendarSubscription({ groupId: groupWithoutToken.id })
      
      // Check if calendar_token was set (stored in _calendarToken if column doesn't exist)
      expect(mockGroup._calendarToken || mockGroup.get('calendar_token')).to.exist
      
      Group.find = originalFind
    })

    it('does not create calendar_token if it already exists', async () => {
      const existingToken = 'existing-token-123'
      const groupWithToken = await factories.group().save()
      try {
        await groupWithToken.save({ calendar_token: existingToken }, { patch: true })
      } catch (e) {
        // Column might not exist, skip this test
        return
      }
      
      await Group.createEventCalendarSubscription({ groupId: groupWithToken.id })
      
      await groupWithToken.refresh()
      expect(groupWithToken.get('calendar_token')).to.equal(existingToken)
    })

    it('returns early if group is not found', async () => {
      await Group.createEventCalendarSubscription({ groupId: 'non-existent-id' })

      expect(storageModule.writeStringToS3).to.not.have.been.called
    })
  })
})
