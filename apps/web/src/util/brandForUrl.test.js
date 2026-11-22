import { brandForUrl } from 'util/brandForUrl'

describe('brandForUrl', () => {
  it('recognizes known sites, including aliases and subdomains', () => {
    expect(brandForUrl('https://x.com/hylo')).toEqual('twitter')
    expect(brandForUrl('https://twitter.com/hylo')).toEqual('twitter')
    expect(brandForUrl('https://www.facebook.com/hylo')).toEqual('facebook')
    expect(brandForUrl('https://m.youtube.com/watch?v=1')).toEqual('youtube')
    expect(brandForUrl('https://youtu.be/abc')).toEqual('youtube')
    expect(brandForUrl('https://foo.substack.com')).toEqual('substack')
  })

  it('returns null for an unknown host or an invalid url', () => {
    expect(brandForUrl('https://example.com')).toBeNull()
    expect(brandForUrl('not a url')).toBeNull()
  })
})
