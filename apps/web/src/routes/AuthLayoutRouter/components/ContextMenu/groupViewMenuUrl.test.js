import { externalLinkHref } from './groupViewMenuUrl'

describe('externalLinkHref', () => {
  it('adds https:// when the stored link has no scheme', () => {
    expect(externalLinkHref({ link: 'google.com' })).toBe('https://google.com')
    expect(externalLinkHref({ link: 'www.google.com' })).toBe('https://www.google.com')
  })

  it('keeps an existing http(s) scheme', () => {
    expect(externalLinkHref({ link: 'https://google.com' })).toBe('https://google.com')
    expect(externalLinkHref({ link: 'http://example.com' })).toBe('http://example.com')
  })

  it('returns null for internal paths and missing links', () => {
    expect(externalLinkHref({ link: '/u/123' })).toBe(null)
    expect(externalLinkHref({ link: null })).toBe(null)
    expect(externalLinkHref({})).toBe(null)
  })
})
