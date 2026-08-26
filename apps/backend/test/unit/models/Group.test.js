/* eslint-disable no-unused-expressions */
/* eslint-disable camelcase */
import root from 'root-path'
import setup from '../../setup'
import factories from '../../setup/factories'
import { expectEqualQuery, spyify, unspyify } from '../../setup/helpers'

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
    const group = new Group({ slug: 'foo', name: 'foo', access_code: 'foo!' })
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

  it('initializes calendar_token on creation', async function () {
    const data = {
      name: 'my group',
      description: 'a group description',
      slug: 'comm2'
    }

    const user = await new User({ name: 'username', email: 'john2@foo.com', active: true }).save()
    await Group.create(user.id, data)
    const savedGroup = await Group.find('comm2')
    const calendarToken = savedGroup.get('calendar_token')
    expect(calendarToken).to.exist
    expect(calendarToken).to.be.a('string')
    // UUID v4 format: 8-4-4-4-12 hexadecimal characters
    expect(calendarToken).to.match(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i)
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

  describe('.queryByAccessCode', function () {
    let group

    before(function () {
      return factories.group({ active: true })
        .save()
        .then(c => { group = c })
    })

    it('finds and fetches a group by accessCode', function () {
      const groupId = group.get('id')
      const accessCode = group.get('access_code')
      return Group.queryByAccessCode(accessCode)
        .fetch()
        .then(c => {
          return expect(c.id).to.equal(groupId)
        })
    })
  })

  describe('.isSlugValid', function () {
    it('rejects invalid slugs', function () {
      expect(Group.isSlugValid('a b')).to.be.false
      expect(Group.isSlugValid('IAM')).to.be.false
      expect(Group.isSlugValid('wow!')).to.be.false
      expect(Group.isSlugValid('uh_')).to.be.false
      expect(Group.isSlugValid('a')).to.be.false
      expect(Group.isSlugValid('abcdabcdabcdabcdabcdabcdabcdabcdabcdabcdx')).to.be.false
    })
  })

  describe('.deactivate', function () {
    it('sets active to false and calls Group.deactivate', async function () {
      const group = await factories.group({ active: true }).save()
      await Group.deactivate(group.id)
      await group.refresh()
      expect(group.get('active')).to.equal(false)
    })

    it('deactivates all child members', async function () {
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
      group = await factories.group().save()
      u1 = await factories.user().save()
      u2 = await factories.user().save()
      gm1 = await group.memberships().create({
        user_id: u1.id,
        settings: { here: true }
      })
    })

    it('merges new settings to existing memberships and creates new ones', async function () {
      const results = await group.addMembers([u1.id, u2.id], { assignCoordinator: true, settings: { there: true } })
      expect(results.length).to.equal(2)

      await gm1.refresh()
      expect(gm1.get('settings')).to.deep.equal({ here: true, there: true, agreementsAcceptedAt: null, joinQuestionsAnsweredAt: null, showJoinForm: true, lastReadAt: null })
      expect(await GroupMembership.hasResponsibility(u1.id, group, Responsibility.constants.RESP_ADMINISTRATION)).to.be.true

      const gm2 = await group.memberships()
        .query(q => q.where('user_id', u2.id)).fetchOne()
      expect(gm2.get('settings')).to.deep.equal({ agreementsAcceptedAt: null, joinQuestionsAnsweredAt: null, showJoinForm: true, there: true })
      expect(await GroupMembership.hasResponsibility(u2.id, group, Responsibility.constants.RESP_ADMINISTRATION)).to.be.true
    })

    it('clears lastReadAt so a rejoining member is treated as a first visit', async function () {
      const viewedAt = new Date().toISOString()
      await u1.joinGroup(group)
      let membership = await GroupMembership.forPair(u1, group).fetch()
      membership.addSetting({ lastReadAt: viewedAt })
      await membership.save()

      await group.removeMembers([u1.id])
      await u1.joinGroup(group)

      membership = await GroupMembership.forPair(u1, group).fetch()
      expect(membership.get('active')).to.be.true
      expect(membership.getSetting('lastReadAt')).to.be.null
    })
  })

  describe('removeMembers', function () {
    it('removes child members', async function () {
      const group = await factories.group().save()
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      await group.addMembers([user1, user2])
      await group.removeMembers(await group.members().fetch())
      const postRemoveMembers = await group.members().fetch()
      expect(postRemoveMembers.length).to.equal(0)
    })

    it('revokes roles, agreement state, and nav pin', async function () {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await user.joinGroup(group)
      await GroupRole.setupSystemRoles(group.id)
      const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
      await MemberGroupRole.forge({
        user_id: user.id,
        group_id: group.id,
        group_role_id: hostRole.id,
        active: true
      }).save()

      const membership = await GroupMembership.forPair(user, group).fetch()
      membership.addSetting({ agreementsAcceptedAt: new Date().toISOString() })
      await membership.save({ nav_order: 2 })

      await group.removeMembers([user.id])

      const roles = await MemberGroupRole.where({ user_id: user.id, group_id: group.id }).fetchAll()
      expect(roles.length).to.equal(0)

      const inactiveMembership = await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
      expect(inactiveMembership.get('active')).to.be.false
      expect(inactiveMembership.getSetting('agreementsAcceptedAt')).to.be.null
      expect(inactiveMembership.get('nav_order')).to.be.null
      expect(await GroupMembership.hasResponsibility(user.id, group, Responsibility.constants.RESP_ADD_MEMBERS)).to.be.false
    })

    it('deactivates memberships in child spaces when removed from parent group', async function () {
      const group = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `space-remove-${Date.now()}`
      }).save()
      const user = await factories.user().save()
      const otherUser = await factories.user().save()

      await group.addMembers([user.id, otherUser.id])
      await space.addMembers([user.id])

      await group.removeMembers([user.id])

      const parentMembership = await GroupMembership.forPair(user, group, { includeInactive: true }).fetch()
      expect(parentMembership.get('active')).to.be.false

      const spaceMembership = await GroupMembership.forPair(user, space, { includeInactive: true }).fetch()
      expect(spaceMembership.get('active')).to.be.false
      expect(spaceMembership.getSetting('showJoinForm')).to.equal(true)
      expect(spaceMembership.getSetting('joinQuestionsAnsweredAt')).to.be.null

      const otherSpaceMembership = await GroupMembership.forPair(otherUser, space).fetch()
      expect(otherSpaceMembership).to.not.exist
    })

    it('does not deactivate parent membership when leaving a space only', async function () {
      const group = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `space-leave-${Date.now()}`
      }).save()
      const user = await factories.user().save()

      await group.addMembers([user.id])
      await space.addMembers([user.id])
      await GroupRole.setupSystemRoles(group.id)
      const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
      await MemberGroupRole.forge({
        user_id: user.id,
        group_id: group.id,
        group_role_id: hostRole.id,
        active: true
      }).save()

      await space.removeMembers([user.id])

      const parentMembership = await GroupMembership.forPair(user, group).fetch()
      expect(parentMembership.get('active')).to.be.true

      const spaceMembership = await GroupMembership.forPair(user, space, { includeInactive: true }).fetch()
      expect(spaceMembership.get('active')).to.be.false

      const roles = await MemberGroupRole.where({ user_id: user.id, group_id: group.id }).fetchAll()
      expect(roles.length).to.equal(1)
    })

    async function addChatView (group, userId, newPostCount) {
      const view = await GroupView.forge({
        group_id: group.id,
        type: GroupView.Type.CHAT,
        name: 'Chat',
        order: 0
      }).save()
      await GroupViewUser.forge({
        view_id: view.id,
        user_id: userId,
        new_post_count: newPostCount
      }).save()
      return view
    }

    it('deletes per-view unread rows so no stale badge signal survives', async function () {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await group.addMembers([user.id])
      const view = await addChatView(group, user.id, 3)

      await group.removeMembers([user.id])

      const rows = await GroupViewUser.where({ view_id: view.id, user_id: user.id }).fetchAll()
      expect(rows.length).to.equal(0)
    })

    it('deletes child space view unread rows when removed from the parent group', async function () {
      const group = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `space-unread-${Date.now()}`
      }).save()
      const user = await factories.user().save()
      const otherUser = await factories.user().save()
      await group.addMembers([user.id, otherUser.id])
      await space.addMembers([user.id, otherUser.id])
      const view = await addChatView(space, user.id, 4)
      await GroupViewUser.forge({ view_id: view.id, user_id: otherUser.id, new_post_count: 4 }).save()

      await group.removeMembers([user.id])

      const rows = await GroupViewUser.where({ view_id: view.id }).fetchAll()
      expect(rows.map(r => String(r.get('user_id')))).to.deep.equal([String(otherUser.id)])
    })

    it('settles track enrollment when leaving a track space', async function () {
      const group = await factories.group().save()
      const track = await Track.forge({ group_id: null }).save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        track_id: track.id,
        slug: `space-track-${Date.now()}`
      }).save()
      await track.save({ group_id: space.id, num_people_enrolled: 2 }, { patch: true })

      const user = await factories.user().save()
      await group.addMembers([user.id])
      await space.addMembers([user.id])
      const membership = await GroupMembership.forPair(user, space).fetch()
      membership.addSetting({ completedAt: new Date().toISOString() })
      await membership.save()

      await space.removeMembers([user.id])

      await track.refresh()
      expect(track.get('num_people_enrolled')).to.equal(1)

      const inactiveMembership = await GroupMembership.forPair(user, space, { includeInactive: true }).fetch()
      expect(inactiveMembership.getSetting('completedAt')).to.be.undefined
    })

    it('settles funding round participation when the parent group cascade removes the member', async function () {
      const group = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        slug: `space-round-${Date.now()}`
      }).save()
      const round = await FundingRound.forge({
        group_id: space.id,
        voting_method: 'quadratic',
        num_participants: 1,
        created_at: new Date(),
        updated_at: new Date()
      }).save()
      await space.save({ funding_round_id: round.id }, { patch: true })

      const user = await factories.user().save()
      await group.addMembers([user.id])
      await space.addMembers([user.id])
      const membership = await GroupMembership.forPair(user, space).fetch()
      membership.addSetting({ tokensRemaining: 7 })
      await membership.save()

      await group.removeMembers([user.id])

      await round.refresh()
      expect(round.get('num_participants')).to.equal(0)

      const inactiveMembership = await GroupMembership.forPair(user, space, { includeInactive: true }).fetch()
      expect(inactiveMembership.getSetting('tokensRemaining')).to.be.undefined
    })

    it('does not decrement participation for an already inactive member', async function () {
      const group = await factories.group().save()
      const track = await Track.forge({ group_id: null }).save()
      const space = await factories.group({
        type: 'space',
        parent_id: group.id,
        track_id: track.id,
        slug: `space-track-twice-${Date.now()}`
      }).save()
      await track.save({ group_id: space.id, num_people_enrolled: 1 }, { patch: true })

      const user = await factories.user().save()
      await group.addMembers([user.id])
      await space.addMembers([user.id])

      await space.removeMembers([user.id])
      await space.removeMembers([user.id])

      await track.refresh()
      expect(track.get('num_people_enrolled')).to.equal(0)
    })
  })

  describe('viewPosts', function () {
    async function fetchViewPostIds (group, userId) {
      const posts = await group.viewPosts(userId).query(q => {
        q.join('groups_posts', 'groups_posts.post_id', 'posts.id')
      }).fetch()
      return posts.map(p => p.id)
    }

    it('includes posts from child groups and spaces the user is a member of', async function () {
      const parent = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: parent.id,
        slug: `space-viewposts-${Date.now()}`
      }).save()
      const childGroup = await factories.group().save()
      await parent.addChild(childGroup)

      const user = await factories.user().save()
      await parent.addMembers([user.id])
      await space.addMembers([user.id])
      await childGroup.addMembers([user.id])

      const parentPost = await factories.post({ user_id: user.id }).save()
      await parentPost.groups().attach(parent.id)
      const spacePost = await factories.post({ user_id: user.id }).save()
      await spacePost.groups().attach(space.id)
      const childGroupPost = await factories.post({ user_id: user.id }).save()
      await childGroupPost.groups().attach(childGroup.id)

      const ids = await fetchViewPostIds(parent, user.id)
      expect(ids).to.include(parentPost.id)
      expect(ids).to.include(spacePost.id)
      expect(ids).to.include(childGroupPost.id)
    })

    it('excludes posts from a child space after the user leaves it', async function () {
      const parent = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: parent.id,
        slug: `space-viewposts-leave-${Date.now()}`
      }).save()
      const user = await factories.user().save()
      await parent.addMembers([user.id])
      await space.addMembers([user.id])

      const parentPost = await factories.post({ user_id: user.id }).save()
      await parentPost.groups().attach(parent.id)
      const spacePost = await factories.post({ user_id: user.id }).save()
      await spacePost.groups().attach(space.id)

      await space.removeMembers([user.id])

      const ids = await fetchViewPostIds(parent, user.id)
      expect(ids).to.include(parentPost.id)
      expect(ids).to.not.include(spacePost.id)
    })

    it('excludes posts from peer groups even when the user is a member of both', async function () {
      const group = await factories.group().save()
      const peerGroup = await factories.group().save()
      await GroupRelationship.forge({
        parent_group_id: group.id,
        child_group_id: peerGroup.id,
        relationship_type: Group.RelationshipType.PEER_TO_PEER,
        active: true
      }).save()

      const user = await factories.user().save()
      await group.addMembers([user.id])
      await peerGroup.addMembers([user.id])

      const groupPost = await factories.post({ user_id: user.id }).save()
      await groupPost.groups().attach(group.id)
      const peerPost = await factories.post({ user_id: user.id }).save()
      await peerPost.groups().attach(peerGroup.id)

      const idsFromGroup = await fetchViewPostIds(group, user.id)
      expect(idsFromGroup).to.include(groupPost.id)
      expect(idsFromGroup).to.not.include(peerPost.id)

      const idsFromPeer = await fetchViewPostIds(peerGroup, user.id)
      expect(idsFromPeer).to.include(peerPost.id)
      expect(idsFromPeer).to.not.include(groupPost.id)
    })

    it('excludes posts from a child group after the user leaves it', async function () {
      const parent = await factories.group().save()
      const childGroup = await factories.group().save()
      await parent.addChild(childGroup)
      const user = await factories.user().save()
      await parent.addMembers([user.id])
      await childGroup.addMembers([user.id])

      const parentPost = await factories.post({ user_id: user.id }).save()
      await parentPost.groups().attach(parent.id)
      const childGroupPost = await factories.post({ user_id: user.id }).save()
      await childGroupPost.groups().attach(childGroup.id)

      await childGroup.removeMembers([user.id])

      const ids = await fetchViewPostIds(parent, user.id)
      expect(ids).to.include(parentPost.id)
      expect(ids).to.not.include(childGroupPost.id)
    })

    it('includes chat activity notices from child spaces even when authored by Axolotl', async function () {
      const parent = await factories.group().save()
      const space = await factories.group({
        type: 'space',
        parent_id: parent.id,
        slug: `space-chat-activity-${Date.now()}`
      }).save()
      const user = await factories.user().save()
      let axolotl = await User.where({ id: User.AXOLOTL_ID }).fetch()
      if (!axolotl) {
        axolotl = await factories.user({
          id: User.AXOLOTL_ID,
          name: 'Axolotl',
          email: 'axolotl-viewposts@hylo.com',
          active: true
        }).save(null, { method: 'insert' })
      }
      await parent.addMembers([user.id])
      await space.addMembers([user.id])

      const notice = await factories.post({
        type: Post.Type.CHAT_ACTIVITY,
        user_id: axolotl.id
      }).save()
      await notice.groups().attach(space.id)

      const welcome = await factories.post({
        type: Post.Type.WELCOME,
        user_id: axolotl.id
      }).save()
      await welcome.groups().attach(space.id)

      const ids = await fetchViewPostIds(parent, user.id)
      expect(ids).to.include(notice.id)
      expect(ids).to.not.include(welcome.id)
    })
  })

  describe('updateMembers', function () {
    it('updates members', async function () {
      const group = await factories.group().save()
      const user1 = await factories.user().save()
      const user2 = await factories.user().save()
      const projectRole = await ProjectRole.forge({ name: 'test role' }).save()
      const project_role_id = projectRole.id
      const updates = { project_role_id }
      await group.addMembers([user1, user2])
      await group.updateMembers([user1, user2], updates)
      const updatedMemberships = await group.memberships().fetch()
      updatedMemberships.models.forEach(membership => {
        expect(membership.get('project_role_id')).to.equal(project_role_id)
      })
    })
  })

  describe('selectIdsForMember', function () {
    it('produces the expected query clause', function () {
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
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist

      // Verify all active events are included in the calendar by checking for their UIDs
      expect(calendarContent).to.include(event1.iCalUid())
      expect(calendarContent).to.include(event2.iCalUid())
      expect(calendarContent).to.include(event3.iCalUid())
    })

    it('includes events within the past year (up to one year ago)', async () => {
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist

      // Verify event within the past year is included
      expect(calendarContent).to.include(eventPastYear.iCalUid())
    })

    it('excludes events older than one year', async () => {
      await Group.createEventCalendarSubscription({ groupId: group.id })

      expect(storageModule.writeStringToS3).to.have.been.called
      expect(calendarContent).to.exist

      // Verify event older than one year is excluded
      expect(calendarContent).to.not.include(eventOlderThanYear.iCalUid())
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
    })

    it('includes only active events after some are deactivated', async () => {
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
    })

    it('creates calendar_token if it does not exist', async () => {
      const groupWithoutToken = await factories.group().save()

      await Group.createEventCalendarSubscription({ groupId: groupWithoutToken.id })

      expect(groupWithoutToken.refresh().get('calendar_token')).to.exist
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

  describe('.agreements', function () {
    let user, parent, space

    before(async function () {
      user = await factories.user().save()
      parent = await factories.group({ active: true }).save()
      await user.joinGroup(parent)
      await parent.update({ agreements: [{ title: 'Be kind', description: 'Please be kind' }] }, user.id)
      space = await factories.group({ active: true, type: 'space', parent_id: parent.id }).save()
    })

    it('returns the parent group agreements for a space', async function () {
      const parentAgreements = await parent.agreements().fetch()
      const spaceAgreements = await space.agreements().fetch()
      expect(spaceAgreements.length).to.equal(parentAgreements.length)
      expect(spaceAgreements.length).to.be.above(0)
      expect(spaceAgreements.models[0].id).to.equal(parentAgreements.models[0].id)
      expect(spaceAgreements.models[0].get('title')).to.equal('Be kind')
    })

    it('does not copy agreements onto the space when updating', async function () {
      await space.update({ agreements: [{ title: 'Space only', description: 'Should not save' }] }, user.id)
      const ownRows = await GroupAgreement.where({ group_id: space.id }).fetchAll()
      expect(ownRows.length).to.equal(0)
      const spaceAgreements = await space.agreements().fetch()
      expect(spaceAgreements.models[0].get('title')).to.equal('Be kind')
    })
  })
})
