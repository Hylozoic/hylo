import { isAtReturnToPath, isInviteReturnPath, withoutInviteParams } from './returnToPath'

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

describe('withoutInviteParams', () => {
  it('drops the join link code and invitation token, keeping the rest', () => {
    expect(withoutInviteParams('/groups/foo/about?accessCode=abc&tab=info')).toBe('/groups/foo/about?tab=info')
    expect(withoutInviteParams('/groups/foo/about?token=xyz')).toBe('/groups/foo/about')
    expect(isInviteReturnPath(withoutInviteParams('/groups/foo/about?token=xyz&accessCode=abc'))).toBe(false)
  })

  it('leaves other paths as they are', () => {
    expect(withoutInviteParams('/groups/foo/stream')).toBe('/groups/foo/stream')
    expect(withoutInviteParams(null)).toBe(null)
  })
})
