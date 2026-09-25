import {
  rewriteSetCookieForFrontendHost,
  shouldRewriteProxySetCookie
} from './rewriteProxySetCookie.js'

describe('shouldRewriteProxySetCookie', () => {
  it('rewrites for Heroku review hosts', () => {
    expect(shouldRewriteProxySetCookie('frontend-1452-redux-per-m6hvju.herokuapp.com')).toBe(true)
  })

  it('does not rewrite for hylo.com frontends', () => {
    expect(shouldRewriteProxySetCookie('staging.hylo.com')).toBe(false)
    expect(shouldRewriteProxySetCookie('www.hylo.com')).toBe(false)
  })

  it('does not rewrite for localhost', () => {
    expect(shouldRewriteProxySetCookie('localhost')).toBe(false)
  })
})

describe('rewriteSetCookieForFrontendHost', () => {
  const stagingCookie = 'hylo.staging.sid2=abc123; Path=/; Domain=.hylo.com; HttpOnly; Secure; SameSite=None'

  it('strips Domain for Heroku review hosts', () => {
    const result = rewriteSetCookieForFrontendHost(
      stagingCookie,
      'frontend-1452-redux-per-m6hvju.herokuapp.com'
    )
    expect(result).not.toMatch(/Domain=/i)
    expect(result).toContain('hylo.staging.sid2=abc123')
  })

  it('leaves cookie unchanged for staging.hylo.com', () => {
    expect(rewriteSetCookieForFrontendHost(stagingCookie, 'staging.hylo.com')).toBe(stagingCookie)
  })
})
