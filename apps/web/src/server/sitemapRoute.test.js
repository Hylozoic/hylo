/* eslint-env jest */
import fs from 'fs'
import http from 'http'
import path from 'path'
import express from 'express'
import { http as mswHttp, passthrough } from 'msw'
import mockGraphqlServer from 'util/testing/mockGraphqlServer'
import { SITEMAP_ROUTES, handleSitemap, indexListsPart, sitemapCache, sitemapFileForPath } from './sitemapRoute'

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

describe('indexListsPart', () => {
  it('matches a part by its full file name only', () => {
    const index = '<sitemap><loc>https://www.example.org/sitemaps/sitemap-12.xml</loc></sitemap>'
    expect(indexListsPart(index, 'sitemap-12.xml')).toBe(true)
    expect(indexListsPart(index, 'sitemap-2.xml')).toBe(false)
    expect(indexListsPart(null, 'sitemap-1.xml')).toBe(false)
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

  const INDEX_XML = [
    '<sitemapindex>',
    '<sitemap><loc>https://www.example.org/sitemaps/sitemap-1.xml</loc></sitemap>',
    '<sitemap><loc>https://www.example.org/sitemaps/sitemap-2.xml</loc></sitemap>',
    '</sitemapindex>'
  ].join('')

  function storedFiles (files) {
    global.fetch.mockImplementation(async url => {
      const name = url.split('/').pop()
      return name in files
        ? { ok: true, text: async () => files[name] }
        : { ok: false, status: 403, text: async () => '' }
    })
  }

  it('serves numbered parts that the index lists', async () => {
    storedFiles({ 'sitemap.xml': INDEX_XML, 'sitemap-2.xml': '<urlset>two</urlset>' })

    const res = await get(server, '/sitemaps/sitemap-2.xml')
    expect(res.status).toBe(200)
    expect(res.body).toBe('<urlset>two</urlset>')
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual([
      'https://uploads.example/prefix/sitemaps/sitemap.xml',
      'https://uploads.example/prefix/sitemaps/sitemap-2.xml'
    ])
  })

  it('does not serve a part the current index no longer lists', async () => {
    storedFiles({ 'sitemap.xml': INDEX_XML, 'sitemap-3.xml': '<urlset>left over</urlset>' })

    const res = await get(server, '/sitemaps/sitemap-3.xml')
    expect(res.status).toBe(404)
    expect(global.fetch.mock.calls.map(([url]) => url)).toEqual(['https://uploads.example/prefix/sitemaps/sitemap.xml'])

    await get(server, '/sitemaps/sitemap-99.xml')
    expect(global.fetch).toHaveBeenCalledTimes(1)
  })

  it('serves no parts when the sitemap fits in one file', async () => {
    storedFiles({ 'sitemap.xml': '<urlset><url><loc>https://www.example.org/post/1</loc></url></urlset>' })
    const res = await get(server, '/sitemaps/sitemap-1.xml')
    expect(res.status).toBe(404)
  })

  it('is not found when no sitemap has been stored, and does not ask storage again for a while', async () => {
    storedFiles({})
    const res = await get(server, '/sitemap.xml')
    expect(res.status).toBe(404)

    await get(server, '/sitemap.xml')
    await get(server, '/sitemaps/sitemap-1.xml')
    expect(global.fetch).toHaveBeenCalledTimes(1)
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
