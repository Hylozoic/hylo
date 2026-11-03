const root = require('root-path')
const setup = require(root('test/setup'))
const factories = require(root('test/setup/factories'))

describe('User.canMessage', () => {
  let viewer, member, stranger, group, otherGroup

  beforeEach(async () => {
    await setup.clearDb()
    viewer = await factories.user().save()
    member = await factories.user().save()
    stranger = await factories.user().save()
    group = await factories.group().save()
    otherGroup = await factories.group().save()
    await group.addMembers([viewer.id, member.id])
    await otherGroup.addMembers([stranger.id])
  })

  it('is true for an active member of a group the viewer belongs to', async () => {
    expect(await User.canMessage(viewer.id, member.id)).to.equal(true)
  })

  it('is false for someone who shares no group and has no connection', async () => {
    expect(await User.canMessage(viewer.id, stranger.id)).to.equal(false)
  })

  it('is false for yourself', async () => {
    expect(await User.canMessage(viewer.id, viewer.id)).to.equal(false)
  })

  it('is false without a viewer or target', async () => {
    expect(await User.canMessage(null, member.id)).to.equal(false)
    expect(await User.canMessage(viewer.id, null)).to.equal(false)
  })

  it('is false when the viewer has blocked them', async () => {
    await factories.blockedUser({ user_id: viewer.id, blocked_user_id: member.id }).save()
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it('is false when they have blocked the viewer', async () => {
    await factories.blockedUser({ user_id: member.id, blocked_user_id: viewer.id }).save()
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it("is false when the target's shared membership is inactive", async () => {
    await bookshelf.knex('group_memberships').where({ user_id: member.id, group_id: group.id }).update({ active: false })
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it("is false when the viewer's shared membership is inactive", async () => {
    await bookshelf.knex('group_memberships').where({ user_id: viewer.id, group_id: group.id }).update({ active: false })
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it('is false when the shared group is inactive', async () => {
    await group.save({ active: false }, { patch: true })
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it('is false for a deactivated user', async () => {
    await member.save({ active: false }, { patch: true })
    expect(await User.canMessage(viewer.id, member.id)).to.equal(false)
  })

  it('is true for one of the viewer\'s connections without a shared group', async () => {
    await factories.userConnection({ user_id: viewer.id, other_user_id: stranger.id }).save()
    expect(await User.canMessage(viewer.id, stranger.id)).to.equal(true)
  })

  it('is false for a connection who is blocked', async () => {
    await factories.userConnection({ user_id: viewer.id, other_user_id: stranger.id }).save()
    await factories.blockedUser({ user_id: stranger.id, blocked_user_id: viewer.id }).save()
    expect(await User.canMessage(viewer.id, stranger.id)).to.equal(false)
  })

  it('is false for a public profile that shares no group (the recipient search does not offer them)', async () => {
    await stranger.save({ is_profile_public: true }, { patch: true })
    expect(await User.canMessage(viewer.id, stranger.id)).to.equal(false)
  })
})
