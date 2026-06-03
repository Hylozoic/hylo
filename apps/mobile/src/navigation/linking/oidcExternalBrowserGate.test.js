import {
  hyloUrlForExternalBrowser,
  shouldOpenHyloOidcInExternalBrowser
} from 'navigation/linking/oidcExternalBrowserGate'

describe('shouldOpenHyloOidcInExternalBrowser', () => {
  it('returns true for /oauth paths on hylo hosts', () => {
    expect(shouldOpenHyloOidcInExternalBrowser('https://www.hylo.com/oauth/login/x')).toBe(true)
    expect(shouldOpenHyloOidcInExternalBrowser('https://staging.hylo.com/oauth/consent/y')).toBe(true)
    expect(shouldOpenHyloOidcInExternalBrowser('/oauth/login/z')).toBe(true)
  })

  it('returns true for /noo/oauth and /noo/oidc', () => {
    expect(shouldOpenHyloOidcInExternalBrowser('https://www.hylo.com/noo/oauth/auth?a=1')).toBe(true)
    expect(shouldOpenHyloOidcInExternalBrowser('https://staging.hylo.com/noo/oidc/interaction/abc')).toBe(true)
  })

  it('returns false for first-party /noo/login', () => {
    expect(shouldOpenHyloOidcInExternalBrowser('https://www.hylo.com/noo/login/token?t=1')).toBe(false)
    expect(shouldOpenHyloOidcInExternalBrowser('https://staging.hylo.com/noo/login/jwt')).toBe(false)
  })

  it('returns false for other hylo paths', () => {
    expect(shouldOpenHyloOidcInExternalBrowser('https://www.hylo.com/groups/foo')).toBe(false)
    expect(shouldOpenHyloOidcInExternalBrowser('https://www.hylo.com/login')).toBe(false)
  })
})

describe('hyloUrlForExternalBrowser', () => {
  it('preserves host and query', () => {
    expect(hyloUrlForExternalBrowser('https://staging.hylo.com/oauth/login/x?n=%2F')).toBe(
      'https://staging.hylo.com/oauth/login/x?n=%2F'
    )
  })
})
