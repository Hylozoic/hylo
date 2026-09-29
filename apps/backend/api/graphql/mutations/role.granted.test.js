/* eslint-disable no-unused-expressions */
import setup from '../../../test/setup'
import factories from '../../../test/setup/factories'
import { mockify, unspyify } from '../../../test/setup/helpers'
import { addGroupRole, addRoleToMember, removeRoleFromMember } from './role'

async function roleNotices (readerId) {
  const activities = await Activity.query(q => {
    q.where('reader_id', readerId)
    q.whereRaw("meta->'reasons' \\? 'roleGranted'")
  }).fetchAll({ withRelated: 'notifications' })
  return activities.models.map(activity => ({
    activity,
    media: activity.related('notifications').map(n => n.get('medium')).sort()
  }))
}

describe('role granted notice (D48)', () => {
  let group, steward, member

  before(async () => {
    await setup.clearDb()
    group = await factories.group({ name: 'Seed Library' }).save()
    steward = await factories.user({ name: 'Sam Steward' }).save()
    member = await factories.user({ first_name: 'Mel' }).save()
    await steward.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  after(() => setup.clearDb())

  it('tells the member once, in-app and by email, when a steward gives them a role by hand', async () => {
    const greeter = await addGroupRole({ groupId: group.id, name: 'Greeter', emoji: '🙂', userId: steward.id })
    await addRoleToMember({ userId: steward.id, roleId: greeter.id, personId: member.id, groupId: group.id })

    const notices = await roleNotices(member.id)
    expect(notices).to.have.length(1)
    expect(notices[0].media).to.deep.equal([Notification.MEDIUM.InApp, Notification.MEDIUM.Email].sort())
    const { activity } = notices[0]
    expect(String(activity.get('actor_id'))).to.equal(String(steward.id))
    expect(String(activity.get('group_id'))).to.equal(String(group.id))
    expect(activity.get('meta')).to.include({ roleId: String(greeter.id), roleName: 'Greeter', roleEmoji: '🙂' })

    // Giving the same role again changes nothing, so it doesn't notify again
    await addRoleToMember({ userId: steward.id, roleId: greeter.id, personId: member.id, groupId: group.id })
    expect(await roleNotices(member.id)).to.have.length(1)
  })

  it('works for the system roles too', async () => {
    const other = await factories.user().save()
    await other.joinGroup(group)
    const host = await GroupRole.findSystemRole(group.id, 'Host')
    await addRoleToMember({ userId: steward.id, roleId: host.id, personId: other.id, groupId: group.id })
    const notices = await roleNotices(other.id)
    expect(notices).to.have.length(1)
    expect(notices[0].activity.get('meta').roleName).to.equal('Host')
  })

  it('refuses a role for someone outside the group, or a role from another group, and tells nobody', async () => {
    const outsider = await factories.user().save()
    const badge = await addGroupRole({ groupId: group.id, name: 'Seed Saver', emoji: '🌻', userId: steward.id })
    await expect(addRoleToMember({ userId: steward.id, roleId: badge.id, personId: outsider.id, groupId: group.id }))
      .to.be.rejectedWith('Only members of the group can be given a role')
    expect(await MemberGroupRole.where({ user_id: outsider.id }).fetch()).to.not.exist
    expect(await roleNotices(outsider.id)).to.be.empty

    const otherGroup = await factories.group().save()
    const otherSteward = await factories.user().save()
    await otherSteward.joinGroup(otherGroup, { assignAdministrator: true })
    const otherRole = await addGroupRole({ groupId: otherGroup.id, name: 'Elsewhere', emoji: '🧭', userId: otherSteward.id })
    const bystander = await factories.user().save()
    await bystander.joinGroup(group)
    await expect(addRoleToMember({ userId: steward.id, roleId: otherRole.id, personId: bystander.id, groupId: group.id }))
      .to.be.rejectedWith('Role not found')
    expect(await MemberGroupRole.where({ user_id: bystander.id, group_role_id: otherRole.id }).fetch()).to.not.exist
    expect(await roleNotices(bystander.id)).to.be.empty
  })

  it('does not notify again when a role is taken away and given back soon after', async () => {
    const person = await factories.user().save()
    await person.joinGroup(group)
    const badge = await addGroupRole({ groupId: group.id, name: 'Composter', emoji: '🪱', userId: steward.id })
    await addRoleToMember({ userId: steward.id, roleId: badge.id, personId: person.id, groupId: group.id })
    await removeRoleFromMember({ userId: steward.id, roleId: badge.id, personId: person.id, groupId: group.id })
    await addRoleToMember({ userId: steward.id, roleId: badge.id, personId: person.id, groupId: group.id })
    expect(await roleNotices(person.id)).to.have.length(1)
  })

  it('does not notify a steward who gives a role to themselves', async () => {
    const badge = await addGroupRole({ groupId: group.id, name: 'Gardener', emoji: '🌱', userId: steward.id })
    await addRoleToMember({ userId: steward.id, roleId: badge.id, personId: steward.id, groupId: group.id })
    expect(await roleNotices(steward.id)).to.be.empty
  })

  it('does not notify for automatic grants', async () => {
    // The creator's Administrator role
    const founder = await factories.user().save()
    const newGroup = await factories.group().save()
    await founder.joinGroup(newGroup, { assignAdministrator: true })
    expect(await roleNotices(founder.id)).to.be.empty

    // A role attached to an invitation
    const invitee = await factories.user().save()
    const inviteRole = await addGroupRole({ groupId: group.id, name: 'Welcomer', emoji: '👐', userId: steward.id })
    const invitation = await factories.invitation({ group_id: group.id, invited_by_id: steward.id, group_role_id: inviteRole.id, email: invitee.get('email') }).save()
    await invitation.use(invitee.id)
    expect(await MemberGroupRole.where({ user_id: invitee.id, group_role_id: inviteRole.id }).fetch()).to.exist
    expect(await roleNotices(invitee.id)).to.be.empty

    // The implicit Member role can't be given by hand at all
    const memberRole = await GroupRole.ensureMemberRole(group.id)
    const person = await factories.user().save()
    await person.joinGroup(group)
    await expect(addRoleToMember({ userId: steward.id, roleId: memberRole.id, personId: person.id, groupId: group.id }))
      .to.be.rejectedWith(GroupRole.MEMBER_ROLE_LOCKED_ERROR)
    expect(await roleNotices(person.id)).to.be.empty
  })

  it('emails the role, who gave it and the group', async () => {
    mockify(Email, 'sendRoleGranted', () => Promise.resolve(true))
    try {
      const [{ activity }] = await roleNotices(member.id)
      const notification = await Notification.query(q => {
        q.where({ activity_id: activity.id, medium: Notification.MEDIUM.Email })
      }).fetch({ withRelated: ['activity', 'activity.reader', 'activity.actor', 'activity.group'] })
      await notification.sendEmail()

      const { email, data } = Email.sendRoleGranted.__spy.calls[0][0]
      expect(email).to.equal(member.get('email'))
      expect(data).to.include({
        subject: 'You have a new role in Seed Library: Greeter',
        first_name: 'Mel',
        granter_name: 'Sam Steward',
        group_name: 'Seed Library',
        role_name: 'Greeter',
        role_emoji: '🙂'
      })
    } finally {
      unspyify(Email, 'sendRoleGranted')
    }
  })
})
