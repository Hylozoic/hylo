const root = require('root-path')
const setup = require(root('test/setup'))
const { spyify, unspyify } = require(root('test/setup/helpers'))
const factories = require(root('test/setup/factories'))

describe('GroupMembership', () => {
  before(async () => setup.clearDb())

  describe('forPair', () => {
    let g, u

    before(async () => {
      g = await factories.group().save()
      u = await factories.user().save()
    })

    it('should throw if no user', () => {
      expect(() => GroupMembership.forPair()).to.throw(/user or user id/)
    })

    it('should throw if no instance', () => {
      expect(() => GroupMembership.forPair(u)).to.throw(/without a group/)
    })

    it('should invoke forIds with the correct ids and model', async () => {
      spyify(GroupMembership, 'forIds')
      await GroupMembership.forPair(u, g)
      expect(GroupMembership.forIds).to.have.been.called.with(u.id, g.id, {})
      unspyify(GroupMembership, 'forIds')
    })
  })

  describe('hasActiveMembership', () => {
    let u, g1, g2, gm

    before(async () => {
      u = await factories.user().save()
      g1 = await factories.group().save()
      g2 = await factories.group().save()
      gm = await u.joinGroup(g1)
    })

    it('returns true if user is a member', async () => {
      const actual = await GroupMembership.hasActiveMembership(u, g1)
      expect(actual).to.equal(true)
    })

    it('returns false if user is not a member', async () => {
      const actual = await GroupMembership.hasActiveMembership(u, g2)
      expect(actual).to.equal(false)
    })

    it('returns false if user is an inactive member', async () => {
      await gm.updateAndSave({ active: false })
      const actual = await GroupMembership.hasActiveMembership(u, g1)
      expect(actual).to.equal(false)
    })
  })

  describe('updateLastViewedAt', () => {
    let u, g1, gm

    before(async () => {
      u = await factories.user().save()
      g1 = await factories.group().save()
      gm = await u.joinGroup(g1)
    })

    it('resets the new post count when no views are unread', async () => {
      await gm.save({ new_post_count: 1 })
      await GroupMembership.updateLastViewedAt(u, g1)
      await gm.refresh()
      expect(gm.get('new_post_count')).to.equal(0)
    })

    it('keeps the chat unread count instead of zeroing on visit', async () => {
      const view = await GroupView.forge({
        group_id: g1.id,
        type: GroupView.Type.CHAT,
        name: 'Chat',
        order: 0
      }).save()
      await GroupViewUser.forge({
        view_id: view.id,
        user_id: u.id,
        new_post_count: 4
      }).save()
      await gm.save({ new_post_count: 0 })
      await GroupMembership.updateLastViewedAt(u, g1)
      await gm.refresh()
      expect(gm.get('new_post_count')).to.equal(4)
    })
  })

  describe('syncBadgeCounts', () => {
    it('sets membership to chat unread plus one per other unread typed view', async () => {
      const group = await factories.group().save()
      const user = await factories.user().save()
      await user.joinGroup(group)
      const chat = await GroupView.forge({
        group_id: group.id,
        type: GroupView.Type.CHAT,
        name: 'Chat',
        order: 0
      }).save()
      const discussions = await GroupView.forge({
        group_id: group.id,
        type: 'discussions',
        name: 'Discussions',
        order: 1
      }).save()
      await GroupViewUser.forge({ view_id: chat.id, user_id: user.id, new_post_count: 7 }).save()
      await GroupViewUser.forge({ view_id: discussions.id, user_id: user.id, new_post_count: 3 }).save()

      await GroupMembership.syncBadgeCounts(group.id, [user.id])
      const membership = await GroupMembership.forPair(user, group).fetch()
      expect(membership.get('new_post_count')).to.equal(8)
    })
  })

  describe('unpinGroupFromAllNavs', () => {
    it('clears the pin and compact remaining nav order for every member', async () => {
      const group = await factories.group().save()
      const otherGroup = await factories.group().save()
      const userA = await factories.user().save()
      const userB = await factories.user().save()
      await userA.joinGroup(group)
      await userA.joinGroup(otherGroup)
      await userB.joinGroup(group)
      await userB.joinGroup(otherGroup)

      await GroupMembership.forPair(userA.id, otherGroup.id).fetch().then(m => m.save({ nav_order: 0 }))
      await GroupMembership.forPair(userA.id, group.id).fetch().then(m => m.save({ nav_order: 1 }))
      await GroupMembership.forPair(userB.id, group.id).fetch().then(m => m.save({ nav_order: 0 }))
      await GroupMembership.forPair(userB.id, otherGroup.id).fetch().then(m => m.save({ nav_order: 1 }))

      await GroupMembership.unpinGroupFromAllNavs(group.id)

      const userAConverted = await GroupMembership.forPair(userA.id, group.id).fetch()
      const userAOther = await GroupMembership.forPair(userA.id, otherGroup.id).fetch()
      const userBConverted = await GroupMembership.forPair(userB.id, group.id).fetch()
      const userBOther = await GroupMembership.forPair(userB.id, otherGroup.id).fetch()

      expect(userAConverted.get('nav_order')).to.be.null
      expect(userAOther.get('nav_order')).to.equal(0)
      expect(userBConverted.get('nav_order')).to.be.null
      expect(userBOther.get('nav_order')).to.equal(0)
    })
  })
})
