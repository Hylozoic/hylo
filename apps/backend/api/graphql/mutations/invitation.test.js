import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createInvitation } from './invitation'

const MEMBER_ROLE_ERROR = 'The Member role cannot be edited, assigned or used as a requirement'

describe('invitation mutation', () => {
  let user, group

  before(function () {
    user = factories.user()
    group = factories.group()
    return Promise.join(group.save(), user.save())
      .then(() => user.joinGroup(group, { assignAdministrator: true }))
  })

  it('createInvitation successfully', () => {
    const data = { emails: ['one@test.com', 'two@test.com'], assignAdministrator: true }
    return createInvitation(user.id, group.id, data)
      .then((ret) => expect(ret.invitations).to.have.lengthOf(2))
  })

  it('createInvitation ignores a custom message and uses the default', () => {
    const data = { emails: ['three@test.com'], message: 'custom override' }
    return createInvitation(user.id, group.id, data)
      .then(async (ret) => {
        const invitation = await Invitation.find(ret.invitations[0].id)
        expect(invitation.get('message')).to.not.include('custom override')
        expect(invitation.get('message')).to.include(group.get('name'))
      })
  })

  it('createInvitation rejects the Member role', async () => {
    const memberRole = await GroupRole.findMemberRole(group.id)
    const email = `member-role-${Date.now()}@test.com`
    await expect(createInvitation(user.id, group.id, { emails: [email], groupRoleId: String(memberRole.id) }))
      .to.be.rejectedWith(MEMBER_ROLE_ERROR)
    const invitations = await Invitation.where({ group_id: group.id, email }).count()
    expect(Number(invitations)).to.equal(0)
  })
})
