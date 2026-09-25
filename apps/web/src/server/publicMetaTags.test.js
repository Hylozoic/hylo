/* eslint-env jest */
import { withPublicMetaTags, requestFromNodeReq, publicMetaTagsPlugin } from './publicMetaTags'

describe('requestFromNodeReq', () => {
  it('prefers x-forwarded-proto and the original URL', () => {
    const req = requestFromNodeReq({
      originalUrl: '/groups/building-hylo',
      url: '/groups/building-hylo',
      headers: { host: 'localhost:3000', 'x-forwarded-proto': 'https' }
    })

    expect(req.protocol).toBe('https')
    expect(req.get('host')).toBe('localhost:3000')
    expect(req.originalUrl).toBe('/groups/building-hylo')
  })
})

describe('withPublicMetaTags', () => {
  it('injects group tags for a public group path', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          group: {
            id: '9',
            name: 'Building Hylo',
            purpose: 'Build tools for communities.',
            description: '',
            avatarUrl: 'https://cdn.example/a.jpg',
            visibility: 2
          }
        }
      })
    })
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicMetaTags(
      html,
      { originalUrl: '/groups/building-hylo', protocol: 'http', get: () => 'localhost:3000' },
      { fetchImpl, apiHost: 'http://api.test' }
    )

    expect(result).toContain('og:title')
    expect(result).toContain('Building Hylo | Hylo')
  })

  it('leaves HTML unchanged when the path is not a public post or group', async () => {
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicMetaTags(html, { url: '/login' })
    expect(result).toBe(html)
  })
})

describe('publicMetaTagsPlugin', () => {
  it('exposes a Vite transformIndexHtml hook', () => {
    const plugin = publicMetaTagsPlugin()
    expect(plugin.name).toBe('hylo-public-meta-tags')
    expect(typeof plugin.transformIndexHtml.handler).toBe('function')
  })
})
