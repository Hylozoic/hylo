import { joinGroup } from './GroupDetail.store'

describe('joinGroup', () => {
  it('tracks an accepted email invitation', () => {
    const action = joinGroup('1', [], null, 'invitation-token')

    expect(action.meta.analytics).toEqual({
      eventName: 'Group Invitation Accepted',
      groupId: '1',
      method: 'email'
    })
  })

  it('tracks an accepted invite link', () => {
    const action = joinGroup('1', [], 'access-code', null)

    expect(action.meta.analytics).toEqual({
      eventName: 'Group Invitation Accepted',
      groupId: '1',
      method: 'link'
    })
  })

  it('does not track an invitation for an open join', () => {
    const action = joinGroup('1', [])

    expect(action.meta.analytics).toBeUndefined()
    expect(action.meta.groupId).toEqual('1')
  })
})
