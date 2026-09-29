/* eslint-disable no-unused-expressions */
import setup from '../../../setup'
import factories from '../../../setup/factories'
import { isSteward, stewardIds } from '../../../../api/models/group/stewardAudience'
import { createRequestHandler } from '../../../../api/graphql'

async function assignSystemRole (user, group, name) {
  const role = await GroupRole.findSystemRole(group.id, name)
  return MemberGroupRole.forge({ user_id: user.id, group_id: group.id, group_role_id: role.id, active: true }).save()
}

async function mediaFor (readerId, reason) {
  const rows = await bookshelf.knex('notifications')
    .join('activities', 'activities.id', 'notifications.activity_id')
    .where('activities.reader_id', readerId)
    .whereRaw("activities.meta->'reasons' \\? ?", [reason])
    .select('notifications.medium')
  return rows.map(row => row.medium).sort()
}

describe('group/stewardAudience', () => {
  let group, space, administrator, moderator, host, adder, member, newcomer, requester

  before(async () => {
    await setup.clearDb()
    group = await factories.group().save()
    space = await factories.group({ type: 'space', parent_id: group.id, slug: `space-stewards-${Date.now()}` }).save()
    administrator = await factories.user({ name: 'Ada Administrator' }).save()
    moderator = await factories.user({ name: 'Mo Moderator' }).save()
    host = await factories.user({ name: 'Hana Host' }).save()
    adder = await factories.user({ name: 'Addy Adder' }).save()
    member = await factories.user({ name: 'Mel Member' }).save()
    newcomer = await factories.user({ name: 'Nia Newcomer' }).save()
    requester = await factories.user({ name: 'Rey Requester' }).save()

    await administrator.joinGroup(group, { assignAdministrator: true })
    for (const person of [moderator, host, adder, member]) await person.joinGroup(group)
    await assignSystemRole(moderator, group, 'Moderator')
    await assignSystemRole(host, group, 'Host')

    // A custom role that can add members is not a steward role
    const adderRole = await GroupRole.forge({ group_id: group.id, name: 'Greeter', emoji: '🙂', type: GroupRole.TYPE_CUSTOM, active: true }).save()
    const addMembersId = await Responsibility.systemId(Responsibility.constants.RESP_ADD_MEMBERS)
    await GroupRoleResponsibility.forge({ group_role_id: adderRole.id, responsibility_id: addMembersId }).save()
    await MemberGroupRole.forge({ user_id: adder.id, group_id: group.id, group_role_id: adderRole.id, active: true }).save()

    // Only the host is a member of the space
    await space.addMembers([host.id, member.id])
  })

  after(() => setup.clearDb())

  describe('stewardIds', () => {
    it('includes Administrators, Moderators and Hosts, and nobody who only holds Add Members', async () => {
      const ids = await stewardIds(group.id)
      expect(ids).to.have.members([administrator.id, moderator.id, host.id].map(String))
      expect(await isSteward(adder.id, group.id)).to.be.false
      expect(await isSteward(member.id, group.id)).to.be.false
    })

    it('reads a space\'s roles on its parent, among the space\'s members', async () => {
      expect(await stewardIds(space.id)).to.deep.equal([String(host.id)])
    })

    it('leaves out excluded people, deactivated roles and deactivated accounts', async () => {
      expect(await stewardIds(group.id, { excludeUserIds: [moderator.id] })).to.not.include(String(moderator.id))
      const hostRole = await GroupRole.findSystemRole(group.id, 'Host')
      await hostRole.save({ active: false }, { patch: true })
      await moderator.save({ active: false }, { patch: true })
      try {
        expect(await stewardIds(group.id)).to.deep.equal([String(administrator.id)])
      } finally {
        await hostRole.save({ active: true }, { patch: true })
        await moderator.save({ active: true }, { patch: true })
      }
    })

    it('counts the legacy Coordinator name as Administrator', async () => {
      const legacyGroup = await factories.group().save()
      const coordinator = await factories.user().save()
      await coordinator.joinGroup(legacyGroup, { assignAdministrator: true })
      const role = await GroupRole.findSystemRole(legacyGroup.id, 'Administrator')
      await role.save({ name: 'Coordinator' }, { patch: true })
      expect(await stewardIds(legacyGroup.id)).to.deep.equal([String(coordinator.id)])
    })
  })

  describe('Group#stewardsByRole (the Stewards list and "message the stewards")', () => {
    it('lists Hosts along with Administrators and Moderators', async () => {
      const stewards = await group.stewardsByRole().fetch()
      expect(stewards.pluck('id').map(String)).to.have.members([administrator.id, moderator.id, host.id].map(String))
    })

    it('is what GraphQL returns for group.stewards', async () => {
      const handler = createRequestHandler()
      const req = factories.mock.request()
      req.url = '/noo/graphql'
      req.method = 'POST'
      req.headers = { 'Content-Type': 'application/json' }
      req.session = { userId: member.id, destroy: () => {} }
      const { executionResult } = await handler.inject({
        document: `{ group(id: "${group.id}") { stewards { items { id } } } }`,
        serverContext: { req, res: factories.mock.response() }
      })
      expect(executionResult.errors).to.be.undefined
      const ids = executionResult.data.group.stewards.items.map(person => person.id)
      expect(ids).to.have.members([administrator.id, moderator.id, host.id].map(String))
    })

    it('messages the same people', async () => {
      const threadId = await Group.messageStewards(member.id, group.id)
      const participants = await bookshelf.knex('posts_users').where('post_id', threadId).pluck('user_id')
      expect(participants.map(String)).to.include.members([administrator.id, moderator.id, host.id].map(String))
      expect(participants.map(String)).to.not.include(String(adder.id))
    })
  })

  describe('Group.afterFinishedJoining', () => {
    it('tells Administrators, Moderators and Hosts, by every channel their settings allow', async () => {
      await newcomer.joinGroup(group)
      await Group.afterFinishedJoining({ userId: newcomer.id, groupId: group.id })

      for (const steward of [administrator, moderator, host]) {
        expect(await mediaFor(steward.id, 'memberJoinedGroup')).to.deep.equal([
          Notification.MEDIUM.InApp, Notification.MEDIUM.Push, Notification.MEDIUM.Email
        ].sort())
      }
      expect(await mediaFor(adder.id, 'memberJoinedGroup')).to.deep.equal([])
      expect(await mediaFor(member.id, 'memberJoinedGroup')).to.deep.equal([])
      expect(await mediaFor(newcomer.id, 'memberJoinedGroup')).to.deep.equal([])
    })

    it('is in-app only after an approved join request', async () => {
      await bookshelf.knex('notifications').del()
      await bookshelf.knex('activities').del()
      await requester.joinGroup(group, { joinSource: GroupMembership.JoinSource.JOIN_REQUEST })
      await Group.afterFinishedJoining({ userId: requester.id, groupId: group.id })

      for (const steward of [administrator, moderator, host]) {
        expect(await mediaFor(steward.id, 'memberJoinedGroup')).to.deep.equal([Notification.MEDIUM.InApp])
      }
      const activity = await Activity.where({ reader_id: host.id, actor_id: requester.id }).fetch()
      expect(activity.get('meta').inAppOnly).to.be.true
    })
  })
})
