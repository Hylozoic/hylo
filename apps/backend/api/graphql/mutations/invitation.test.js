import '../../../test/setup'
import factories from '../../../test/setup/factories'
import { createInvitation } from './invitation'

describe('invitation mutation', () => {
  var user, group

  before(function () {
    user = factories.user()
    group = factories.group()
    return Promise.join(group.save(), user.save())
      .then(() => user.joinGroup(group, { assignCoordinator: true }))
  })

  it('createInvitation successfully', () => {
    const data = {emails: ['one@test.com', 'two@test.com'], assignCoordinator: true}
    return createInvitation(user.id, group.id, data)
      .then((ret) => expect(ret.invitations).to.have.lengthOf(2))
  })

  it('createInvitation ignores a custom message and uses the default', () => {
    const data = {emails: ['three@test.com'], message: 'custom override'}
    return createInvitation(user.id, group.id, data)
      .then(async (ret) => {
        const invitation = await Invitation.find(ret.invitations[0].id)
        expect(invitation.get('message')).to.not.include('custom override')
        expect(invitation.get('message')).to.include(group.get('name'))
      })
  })
})
