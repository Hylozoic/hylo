import { cancelJoinRequest } from './ManageInvitesTab.store'

describe('cancelJoinRequest', () => {
  it('tracks Join Request Canceled for the group', () => {
    const action = cancelJoinRequest('10', '1')

    expect(action.meta.id).toEqual('10')
    expect(action.meta.analytics).toEqual({
      eventName: 'Join Request Canceled',
      groupId: '1'
    })
  })
})
