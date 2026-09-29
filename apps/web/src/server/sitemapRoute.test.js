/* eslint-env jest */
import fs from 'fs'
import http from 'http'
import path from 'path'
import express from 'express'
import { http as mswHttp, passthrough } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { SITEMAP_ROUTES, handleSitemap, sitemapCache, sitemapFileForPath } from './sitemapRoute'

const publicDir = path.join(__dirname, '../../public')

// Requests to the local test server go straight through
beforeEach(() => mockGraphqlServer.use(mswHttp.get(/^http:\/\/127\.0\.0\.1:\d+\//, () => passthrough())))
const APP_HTML = '<html><body>app</body></html>'

// The same order as src/server/index.js: sitemap routes, static files, then the app HTML
function makeServer () {
  const app = express()
  app.get(SITEMAP_ROUTES, handleSitemap)
  app.use(express.static(publicDir))
  app.use((req, res) => res.status(200).send(APP_HTML))
  return new Promise(resolve => {
    const server = app.listen(0, () => resolve(server))
  })
}

function get (server, urlPath) {
  const { port } = server.address()
  return new Promise((resolve, reject) => {
    http.get({ host: '127.0.0.1', port, path: urlPath }, res => {
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }))
    }).on('error', reject)
  })
}

describe('robots.txt', () => {
  let server

  beforeAll(async () => { server = await makeServer() })
  afterAll(() => new Promise(resolve => server.close(resolve)))

  it('is served as a text file instead of the app HTML', async () => {
    const res = await get(server, '/robots.txt')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/text\/plain/)
    expect(res.body).toContain('User-agent: *')
    expect(res.body).not.toContain(APP_HTML)
  })

  it('keeps crawlers out of the signed-in app and invitation links and points to the sitemap', () => {
    const robots = fs.readFileSync(path.join(publicDir, 'robots.txt'), 'utf8')
    const rules = robots.split('\n')
    expect(rules).toContain('Allow: /')
    expect(rules).toContain('Disallow: /groups/*/join/')
    expect(rules).toContain('Disallow: /h/')
    expect(rules).toContain('Disallow: /noo/')
    expect(rules).toContain('Disallow: /search')
    expect(rules).not.toContain('Disallow: /post/')
    expect(rules).not.toContain('Disallow: /groups/')
    expect(robots).toMatch(/^Sitemap: https:\/\/[^\s]+\/sitemap\.xml$/m)
  })
})

describe('sitemapFileForPath', () => {
  it('maps the index and numbered parts to their stored names', () => {
    expect(sitemapFileForPath('/sitemap.xml')).toBe('sitemap.xml')
    expect(sitemapFileForPath('/sitemap.xml?x=1')).toBe('sitemap.xml')
    expect(sitemapFileForPath('/sitemaps/sitemap-12.xml')).toBe('sitemap-12.xml')
  })

  it('ignores anything else', () => {
    expect(sitemapFileForPath('/sitemaps/other.xml')).toBeNull()
    expect(sitemapFileForPath('/sitemaps/../secret.xml')).toBeNull()
    expect(sitemapFileForPath('/groups/sitemap.xml')).toBeNull()
  })
})

describe('/sitemap.xml', () => {
  const originalFetch = global.fetch
  const originalSource = process.env.SITEMAP_SOURCE_URL
  let server

  beforeAll(async () => { server = await makeServer() })
  afterAll(() => new Promise(resolve => server.close(resolve)))

  beforeEach(() => {
    sitemapCache.reset()
    process.env.SITEMAP_SOURCE_URL = 'https://uploads.example/prefix/sitemaps/'
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    if (originalSource === undefined) delete process.env.SITEMAP_SOURCE_URL
    else process.env.SITEMAP_SOURCE_URL = originalSource
  })

  it('serves the stored sitemap as XML and caches it', async () => {
    const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset></urlset>'
    global.fetch.mockResolvedValue({ ok: true, text: async () => xml })

    const res = await get(server, '/sitemap.xml')
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toMatch(/application\/xml/)
    expect(res.body).toBe(xml)
    expect(global.fetch.mock.calls[0][0]).toBe('https://uploads.example/prefix/sitemaps/sitemap.xml')

    await get(server, '/sitemap.xml')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('serves numbered parts of a split sitemap', async () => {
    global.fetch.mockResolvedValue({ ok: true, text: async () => '<urlset />' })

    const res = await get(server, '/sitemaps/sitemap-2.xml')
    expect(res.status).toBe(200)
    expect(global.fetch.mock.calls[0][0]).toBe('https://uploads.example/prefix/sitemaps/sitemap-2.xml')
  })

  it('is not found when no sitemap has been stored', async () => {
    global.fetch.mockResolvedValue({ ok: false, status: 403, text: async () => '' })
    const res = await get(server, '/sitemap.xml')
    expect(res.status).toBe(404)
  })

  it('is not found when the sitemap source is not configured', async () => {
    delete process.env.SITEMAP_SOURCE_URL
    const res = await get(server, '/sitemap.xml')
    expect(res.status).toBe(404)
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('says the sitemap is unavailable when storage cannot be reached', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {})
    global.fetch.mockRejectedValue(new Error('network down'))
    const res = await get(server, '/sitemap.xml')
    expect(res.status).toBe(502)
    console.error.mockRestore()
  })
})
