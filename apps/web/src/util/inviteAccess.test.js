import { GROUP_TYPES } from 'store/models/Group'
import { inviteAccessFor } from './inviteAccess'

describe('inviteAccessFor', () => {
  it('is full for people who can add members', () => {
    expect(inviteAccessFor({ id: '1' }, true)).toBe('full')
    expect(inviteAccessFor({ id: '2', type: GROUP_TYPES.space, parentId: '1' }, true)).toBe('full')
  })

  it('is null when the person cannot add members', () => {
    expect(inviteAccessFor({ id: '1' }, false)).toBeNull()
    expect(inviteAccessFor({ id: '1', myInviteAccess: 'limited' }, false)).toBeNull()
    expect(inviteAccessFor(null, false)).toBeNull()
    expect(inviteAccessFor(null, true)).toBeNull()
  })
})
