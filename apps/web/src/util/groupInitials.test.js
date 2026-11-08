import { groupInitials, isDefaultGroupAvatar } from './groupInitials'

describe('groupInitials', () => {
  it('uses the first letter of the first two words', () => {
    expect(groupInitials('with boundary')).toBe('WB')
  })

  it('uses one letter for a single word', () => {
    expect(groupInitials('Hylo')).toBe('H')
  })

  it('returns an empty string when there is no name', () => {
    expect(groupInitials('')).toBe('')
    expect(groupInitials(null)).toBe('')
  })
})

describe('isDefaultGroupAvatar', () => {
  it('treats a missing or stock avatar as the default', () => {
    expect(isDefaultGroupAvatar(null)).toBe(true)
    expect(isDefaultGroupAvatar('/default-group-avatar.svg')).toBe(true)
    expect(isDefaultGroupAvatar('https://hylo.com/default-group-avatar.svg')).toBe(true)
  })

  it('keeps an uploaded avatar', () => {
    expect(isDefaultGroupAvatar('https://cdn.example/group.png')).toBe(false)
  })
})
