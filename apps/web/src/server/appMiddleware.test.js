/* eslint-env jest */
import appMiddleware from './appMiddleware'
import { groupMetaCache } from './groupMetaTags'

const INDEX_HTML = '<html><head><title>Hylo</title></head><body><div id="root"></div></body></html>'

const request = originalUrl => ({
  originalUrl,
  query: {},
  protocol: 'https',
  get: name => ({ host: 'hylo.com' })[name]
})

const graphqlResponse = data => ({ ok: true, json: async () => ({ data }) })

async function render (originalUrl) {
  const res = { status: jest.fn().mockReturnThis(), send: jest.fn() }
  await appMiddleware(request(originalUrl), res)
  expect(res.status).toHaveBeenCalledWith(200)
  return res.send.mock.calls[0][0]
}

const count = (html, text) => html.split(text).length - 1

describe('appMiddleware', () => {
  const originalFetch = global.fetch
  const originalGetIndexFile = appMiddleware.getIndexFile

  beforeEach(() => {
    groupMetaCache.reset()
    appMiddleware.getIndexFile = () => INDEX_HTML
    global.fetch = jest.fn()
  })

  afterEach(() => {
    global.fetch = originalFetch
    appMiddleware.getIndexFile = originalGetIndexFile
  })

  it('keeps the post tags on a public post page and adds no group or default tags', async () => {
    global.fetch.mockResolvedValue(graphqlResponse({
      post: { id: '42', title: 'Garden day', details: '<p>Hello</p>', attachments: [] }
    }))

    const html = await render('/groups/garden-club/post/42')

    expect(global.fetch).toHaveBeenCalledTimes(1)
    expect(html).toContain('<meta property="og:title" content="Garden day" />')
    expect(count(html, 'property="og:title"')).toBe(1)
    expect(count(html, '<title>')).toBe(1)
  })

  it('gives a public group page its group tags and no default tags', async () => {
    global.fetch.mockResolvedValue(graphqlResponse({
      group: { name: 'Garden Club', description: 'We grow food.', visibility: 2 }
    }))

    const html = await render('/groups/garden-club')

    expect(html).toContain('<meta property="og:title" content="Garden Club" />')
    expect(count(html, 'property="og:title"')).toBe(1)
    expect(count(html, '<title>')).toBe(1)
  })

  it('gives any other page the Hylo tags', async () => {
    const html = await render('/login')

    expect(global.fetch).not.toHaveBeenCalled()
    expect(html).toContain('<meta property="og:title" content="Hylo" />')
    expect(html).toContain('<meta property="og:image" content="https://hylo.com/hylo-merkaba.png" />')
    expect(html).toContain('<meta property="og:description" content="Hylo is the prosocial coordination platform for purpose-driven groups" />')
  })

  it("doesn't put the default description on a group page", async () => {
    global.fetch.mockResolvedValue(graphqlResponse({
      group: { name: 'Garden Club', description: 'We grow food.', visibility: 2 }
    }))

    const html = await render('/groups/garden-club')

    expect(html).toContain('<meta property="og:description" content="We grow food." />')
    expect(html).not.toContain('prosocial coordination platform')
  })

  describe('iOS Smart App Banner', () => {
    it('opens the current page in the app', async () => {
      const html = await render('/login')
      expect(html).toContain('<meta name="apple-itunes-app" content="app-id=1002185140, app-argument=https://hylo.com/login" />')
      expect(count(html, 'name="apple-itunes-app"')).toBe(1)
    })

    it('is on post and group pages too', async () => {
      global.fetch.mockResolvedValue(graphqlResponse({
        group: { name: 'Garden Club', description: 'We grow food.', visibility: 2 }
      }))
      const html = await render('/groups/garden-club')
      expect(html).toContain('app-argument=https://hylo.com/groups/garden-club"')
    })

    it('escapes the page URL', async () => {
      const html = await render('/groups/x/join/abc?a="b"&c=<d>,e')
      expect(html).toContain('app-argument=https://hylo.com/groups/x/join/abc?a=&quot;b&quot;&amp;c=&lt;d&gt;%2Ce"')
      expect(html).not.toContain('a="b"')
    })
  })
})
