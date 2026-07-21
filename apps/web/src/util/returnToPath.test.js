import { isAtReturnToPath, isInviteReturnPath } from './returnToPath'

describe('isInviteReturnPath', () => {
  it('returns true for about URLs with accessCode', () => {
    expect(isInviteReturnPath('/groups/my-group/about?accessCode=abc123')).toBe(true)
  })

  it('returns true for about URLs with token', () => {
    expect(isInviteReturnPath('/groups/my-group/about?token=invite-token')).toBe(true)
  })

  it('returns false for paths without invite params', () => {
    expect(isInviteReturnPath('/groups/my-group/about')).toBe(false)
    expect(isInviteReturnPath('/my/posts')).toBe(false)
  })
})

describe('isAtReturnToPath', () => {
  it('matches pathname and search exactly', () => {
    const location = { pathname: '/groups/foo/about', search: '?accessCode=abc' }
    expect(isAtReturnToPath(location, '/groups/foo/about?accessCode=abc')).toBe(true)
  })

  it('does not match when query params differ', () => {
    const location = { pathname: '/groups/foo/about', search: '' }
    expect(isAtReturnToPath(location, '/groups/foo/about?accessCode=abc')).toBe(false)
  })
})
