import { authPathWithReturnTo, isAtReturnToPath, isInviteReturnPath } from './returnToPath'

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

describe('authPathWithReturnTo', () => {
  it('adds the encoded return path as returnToUrl', () => {
    expect(authPathWithReturnTo('/signup', '/post/91?action=unfollow'))
      .toBe('/signup?returnToUrl=%2Fpost%2F91%3Faction%3Dunfollow')
    expect(authPathWithReturnTo('/login', '/groups/foo/about'))
      .toBe('/login?returnToUrl=%2Fgroups%2Ffoo%2Fabout')
  })

  it('leaves the link alone when there is nowhere to return to', () => {
    expect(authPathWithReturnTo('/signup', '/')).toBe('/signup')
    expect(authPathWithReturnTo('/signup', '')).toBe('/signup')
    expect(authPathWithReturnTo('/login', undefined)).toBe('/login')
  })
})
