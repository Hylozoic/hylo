import '../../../test/setup'
import { updateMembership } from './membership'
import factories from '../../../test/setup/factories'

describe('membership.test', function () {
  it('keeps group and space pins in one per-user order', async function () {
    const user = await factories.user().save()
    const parentGroup = await factories.group().save()
    const space = await factories.group({ type: 'space', parent_id: parentGroup.id }).save()
    await user.joinGroup(parentGroup)
    await user.joinGroup(space)

    const parentMembership = await GroupMembership.forPair(user, parentGroup).fetch()
    const spaceMembership = await GroupMembership.forPair(user, space).fetch()
    await parentMembership.save({ nav_order: 0 })

    await updateMembership(user.id, {
      groupId: space.id,
      data: { navOrder: 0 }
    })

    await parentMembership.refresh()
    await spaceMembership.refresh()
    expect(spaceMembership.get('nav_order')).to.equal(0)
    expect(parentMembership.get('nav_order')).to.equal(1)

    await updateMembership(user.id, {
      groupId: parentGroup.id,
      data: { navOrder: 0 }
    })

    await parentMembership.refresh()
    await spaceMembership.refresh()
    expect(parentMembership.get('nav_order')).to.equal(0)
    expect(spaceMembership.get('nav_order')).to.equal(1)
  })

  it('handles some values specially', async function () {
    const user = await factories.user().save()
    const group = await factories.group().save()
    await group.addMembers([user])
    const date = new Date()

    await updateMembership(user.id, {
      groupId: group.id,
      data: {
        newPostCount: 7,
        lastViewedAt: date,
        settings: {
          sendPushNotifications: true
        }
      }
    })

    const membership = await GroupMembership.forPair(user, group).fetch()
    expect(membership.get('new_post_count')).to.equal(7)
    expect(membership.getSetting('sendPushNotifications')).to.equal(true)
    expect(membership.getSetting('lastReadAt')).to.equal(date.toISOString())
  })

  it('records lastViewedAt when settings is omitted without clearing other settings', async function () {
    const user = await factories.user().save()
    const group = await factories.group().save()
    await group.addMembers([user])
    const existing = await GroupMembership.forPair(user, group).fetch()
    existing.addSetting({
      sendEmail: false,
      digestFrequency: 'weekly',
      showJoinForm: false,
      agreementsAcceptedAt: '2020-01-01T00:00:00.000Z'
    })
    await existing.save()
    const date = new Date()

    await updateMembership(user.id, {
      groupId: group.id,
      data: { lastViewedAt: date }
    })

    const membership = await GroupMembership.forPair(user, group).fetch()
    expect(membership.getSetting('lastReadAt')).to.equal(date.toISOString())
    expect(membership.getSetting('sendEmail')).to.equal(false)
    expect(membership.getSetting('digestFrequency')).to.equal('weekly')
    expect(membership.getSetting('showJoinForm')).to.equal(false)
    expect(membership.getSetting('agreementsAcceptedAt')).to.equal('2020-01-01T00:00:00.000Z')
    expect(membership.getSetting('sendPushNotifications')).to.equal(true)
    expect(membership.getSetting('postNotifications')).to.equal('all')
  })
})
