import '../../../test/setup'
import { rejoinGroup, updateMembership } from './membership'
import factories from '../../../test/setup/factories'

describe('membership.test', function () {
  async function grantScope (userId, groupId, expiresAt = null) {
    await bookshelf.knex('user_scopes').insert({
      user_id: userId,
      scope: `group:${groupId}`,
      expires_at: expiresAt,
      source_kind: 'grant',
      source_id: 999999999,
      created_at: new Date(),
      updated_at: new Date()
    })
  }

  it('reactivates an inactive paid-group membership when its scope is valid', async function () {
    const user = await factories.user().save()
    const group = await factories.group().save({ paywall: true })
    await group.addMembers([user])
    const original = await GroupMembership.forPair(user, group).fetch()
    original.addSetting({ postNotifications: 'important', digestFrequency: 'weekly', sendEmail: false })
    await original.save()
    await grantScope(user.id, group.id)
    await group.removeMembers([user])
    const scopeAfterLeave = await bookshelf.knex('user_scopes').where({ user_id: user.id, scope: `group:${group.id}` }).first()
    expect(scopeAfterLeave).to.not.equal(undefined)

    const rejoined = await rejoinGroup(user.id, group.id)
    const membership = await GroupMembership.forPair(user, group).fetch()
    const scope = await bookshelf.knex('user_scopes').where({ user_id: user.id, scope: `group:${group.id}` }).first()

    expect(rejoined.id).to.equal(original.id)
    expect(membership.get('active')).to.equal(true)
    expect(membership.getSetting('postNotifications')).to.equal('important')
    expect(membership.getSetting('digestFrequency')).to.equal('weekly')
    expect(membership.getSetting('sendEmail')).to.equal(false)
    expect(membership.getSetting('showJoinForm')).to.equal(false)
    expect(scope).to.not.equal(undefined)
    expect(scope.source_kind).to.equal('grant')
    expect(scope.expires_at).to.equal(null)

    const repeated = await rejoinGroup(user.id, group.id)
    const memberships = await GroupMembership.forIds(user.id, group.id, { includeInactive: true, multiple: true }).fetch()
    expect(repeated.id).to.equal(original.id)
    expect(memberships.length).to.equal(1)
  })

  it('rejects rejoining when the retained scope is expired or missing', async function () {
    const user = await factories.user().save()
    const group = await factories.group().save({ paywall: true })
    await group.addMembers([user])
    await group.removeMembers([user])
    await grantScope(user.id, group.id, new Date(Date.now() - 60_000))

    await expect(rejoinGroup(user.id, group.id)).to.be.rejectedWith('no longer have access')
    await bookshelf.knex('user_scopes').where({ user_id: user.id, scope: `group:${group.id}` }).del()
    await expect(rejoinGroup(user.id, group.id)).to.be.rejectedWith('no longer have access')
    const membership = await GroupMembership.forPair(user.id, group.id, { includeInactive: true }).fetch()
    expect(membership.get('active')).to.equal(false)
  })

  it('requires active parent membership to rejoin a paid space', async function () {
    const user = await factories.user().save()
    const parent = await factories.group().save()
    const space = await factories.group().save({
      parent_id: parent.id,
      type: 'space',
      paywall: true
    })
    await parent.addMembers([user])
    await space.addMembers([user])
    await grantScope(user.id, space.id)
    await parent.removeMembers([user])

    await expect(rejoinGroup(user.id, space.id)).to.be.rejectedWith('rejoin the parent group first')
    const inactive = await GroupMembership.forPair(user.id, space.id, { includeInactive: true }).fetch()
    expect(inactive.get('active')).to.equal(false)

    await parent.addMembers([user])
    const rejoined = await rejoinGroup(user.id, space.id)
    expect(rejoined.get('active')).to.equal(true)
    expect(rejoined.getSetting('leftSpace')).to.equal(false)
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
