import {
  transformPathname,
  IOS_SITE_ASSOCIATION_FILE
} from './proxy'

describe('transformPathname', () => {
  // don't depend on a local .env: use a fixed host (trailing slash is stripped by transformPathname)
  const originalProxyHost = process.env.PROXY_HOST
  beforeAll(() => { process.env.PROXY_HOST = 'https://proxy.example.com/' })
  afterAll(() => {
    if (originalProxyHost === undefined) delete process.env.PROXY_HOST
    else process.env.PROXY_HOST = originalProxyHost
  })

  it('forwards to index.html when no file extension present', () => {
    const actual = '/'
    const expected = 'https://proxy.example.com/index.html'
    const result = transformPathname(actual)
    expect(result).toEqual(expected)
  })

  it(`forwards /${IOS_SITE_ASSOCIATION_FILE} to ${IOS_SITE_ASSOCIATION_FILE}.json`, () => {
    const actual = `/${IOS_SITE_ASSOCIATION_FILE}`
    const expected = `https://proxy.example.com/${IOS_SITE_ASSOCIATION_FILE}.json`
    const result = transformPathname(actual)
    expect(result).toEqual(expected)
  })

  it('forwards /blog to /blog/index.html', () => {
    const result = transformPathname('/blog')
    expect(result).toEqual('https://proxy.example.com/blog/index.html')
  })

  it('forwards /blog/my-post to /blog/my-post/index.html', () => {
    const result = transformPathname('/blog/my-post')
    expect(result).toEqual('https://proxy.example.com/blog/my-post/index.html')
  })
})
