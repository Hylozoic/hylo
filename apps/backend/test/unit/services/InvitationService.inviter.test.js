/* eslint-disable no-unused-expressions */
const root = require('root-path')
require(root('test/setup'))
const factories = require(root('test/setup/factories'))
const { withFeatureFlag } = require(root('test/setup/helpers'))
const InvitationService = require(root('api/services/InvitationService'))

// Who the invitation check says invited someone, shown on the group's about page
describe('InvitationService.check: who invited the person', () => {
  let steward, member, group

  const sender = user => ({ id: user.id, name: user.get('name'), avatarUrl: user.get('avatar_url') || null })

  before(async () => {
    steward = await factories.user({ name: 'Steward Sender', avatar_url: 'https://example.com/steward.png' }).save()
    member = await factories.user({ name: 'Member Sender' }).save()
    group = await factories.group({ accessibility: Group.Accessibility.OPEN }).save()
    await steward.joinGroup(group, { assignAdministrator: true })
    await member.joinGroup(group)
  })

  it("names the steward who sent an email invitation, with only their id, name and avatar", async () => {
    const invitation = await Invitation.create({ userId: steward.id, groupId: group.id, email: 'invitee@inviter-check.com' })
    const check = await InvitationService.check(invitation.get('token'))
    expect(check).to.include({ valid: true, groupSlug: group.get('slug'), requiresApproval: false })
    expect(check.invitedBy).to.deep.equal(sender(steward))
    expect(Object.keys(check.invitedBy).sort()).to.deep.equal(['avatarUrl', 'id', 'name'])
  })

  it("names nobody for the group's own join link", async () => {
    const check = await InvitationService.check(null, group.get('access_code'))
    expect(check.valid).to.be.true
    expect(check.invitedBy).to.be.null
  })

  it("names the member whose personal invite link it is", async () => {
    await withFeatureFlag('MEMBER_INVITES', 'on', async () => {
      await GroupRole.setInvitePolicy(group.id, { mode: 'everyone' })
      const link = await MemberInviteLink.findOrCreate({ groupId: group.id, userId: member.id })
      const check = await InvitationService.check(null, link.get('code'))
      expect(check).to.include({ valid: true, isMemberLink: true })
      expect(check.invitedBy).to.deep.equal(sender(member))
    })
  })

  it('names nobody for an invitation that has been used', async () => {
    const invitation = await Invitation.create({ userId: steward.id, groupId: group.id, email: 'used@inviter-check.com' })
    await invitation.save({ used_by_id: member.id, used_at: new Date() }, { patch: true })
    expect(await InvitationService.check(invitation.get('token'))).to.deep.equal({ valid: false })
  })
})
