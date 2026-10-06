import { groupRolesForPicker, isMemberGroupRole, isSystemGroupRole } from '@hylo/hooks/groupRoleHelpers'

describe('isMemberGroupRole', () => {
  it('is true only for the implicit Member role', () => {
    expect(isMemberGroupRole({ id: '9', name: 'Member', type: 'member' })).toBe(true)
    expect(isMemberGroupRole({ id: '1', name: 'Administrator', type: 'system' })).toBe(false)
    expect(isMemberGroupRole({ id: '7', name: 'Member', type: 'custom' })).toBe(false)
    expect(isMemberGroupRole(null)).toBe(false)
  })

  it('is not a system role', () => {
    expect(isSystemGroupRole({ id: '9', name: 'Member', type: 'member' })).toBe(false)
  })
})

describe('groupRolesForPicker', () => {
  it('never offers the Member role', () => {
    const roles = [
      { id: '9', name: 'Member', type: 'member', active: true },
      { id: '3', name: 'Host', type: 'system', active: true },
      { id: '1', name: 'Administrator', type: 'system', active: true },
      { id: '12', name: 'Gardener', emoji: '🌱', type: 'custom', active: true }
    ]

    expect(groupRolesForPicker(roles).map(role => role.name)).toEqual(['Administrator', 'Host', 'Gardener'])
  })
})
