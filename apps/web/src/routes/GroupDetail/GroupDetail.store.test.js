import { createJoinRequest, joinGroup } from './GroupDetail.store'

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

  it("tracks joining through a member's personal invite link", () => {
    const action = joinGroup('1', [], 'member-code', null, true, true)

    expect(action.meta.analytics).toEqual({
      eventName: 'Group Invitation Accepted',
      groupId: '1',
      method: 'member'
    })
  })

  it('does not track an invitation for an open join', () => {
    const action = joinGroup('1', [])

    expect(action.meta.analytics).toBeUndefined()
    expect(action.meta.groupId).toEqual('1')
  })
})

describe('createJoinRequest', () => {
  it("sends the code of the member's invite link the request comes from", () => {
    const action = createJoinRequest('1', [], undefined, 'member-code')

    expect(action.graphql.variables).toEqual({ groupId: '1', questionAnswers: [], invitationToken: undefined, accessCode: 'member-code' })
  })

  it('tracks Join Request Created', () => {
    const action = createJoinRequest('1', [])

    expect(action.meta.analytics).toEqual({
      eventName: 'Join Request Created',
      groupId: '1'
    })
  })
})
