/* eslint-env jest */
import {
  resolveGroupMetaRoute,
  presentGroupMeta,
  fetchGroupMeta,
  withGroupMetaTags,
  withDefaultMetaTags,
  groupMetaCache,
  localeFromAcceptLanguage,
  defaultPreviewDescription,
  resetDefaultPreviewDescriptions
} from './groupMetaTags'

const HTML = '<html><head><title>Hylo</title></head><body></body></html>'
const API = 'http://api.test'

const request = (originalUrl, query = {}) => ({
  originalUrl,
  query,
  protocol: 'http',
  get: name => ({ host: 'hylo.com', 'x-forwarded-proto': 'https' })[name]
})

const graphqlResponse = data => ({ ok: true, json: async () => ({ data }) })

const publicGroup = {
  name: 'Garden Club',
  description: '<p>We grow <strong>food</strong> together.</p>',
  purpose: 'Grow food',
  avatarUrl: 'https://cdn.example/avatar.png',
  bannerUrl: 'https://cdn.example/banner.jpg',
  visibility: 2
}

beforeEach(() => {
  groupMetaCache.reset()
})

describe('resolveGroupMetaRoute', () => {
  it('reads the group slug from group pages', () => {
    expect(resolveGroupMetaRoute('/groups/garden-club')).toEqual({ slug: 'garden-club' })
    expect(resolveGroupMetaRoute('/groups/garden-club/chat/general')).toEqual({ slug: 'garden-club' })
  })

  it('reads the access code from join links', () => {
    expect(resolveGroupMetaRoute('/groups/garden-club/join/abc123')).toEqual({ slug: 'garden-club', accessCode: 'abc123' })
  })

  it('reads the token from invitation links', () => {
    expect(resolveGroupMetaRoute('/h/use-invitation', { token: 'tok', email: 'a@b.c' })).toEqual({ invitationToken: 'tok' })
    expect(resolveGroupMetaRoute('/h/use-invitation', {})).toBe(null)
  })

  it('leaves post pages and other routes alone', () => {
    expect(resolveGroupMetaRoute('/groups/garden-club/post/42')).toBe(null)
    expect(resolveGroupMetaRoute('/my/posts')).toBe(null)
    expect(resolveGroupMetaRoute('/groups')).toBe(null)
  })
})

describe('presentGroupMeta', () => {
  it('uses the name, plain-text description and banner of a public group', () => {
    expect(presentGroupMeta(publicGroup)).toEqual({
      title: 'Garden Club',
      description: 'We grow food together.',
      imageUrl: 'https://cdn.example/banner.jpg',
      largeImage: true
    })
  })

  it('leaves the description out for a group that is not public', () => {
    const meta = presentGroupMeta({ ...publicGroup, visibility: 1 })
    expect(meta.title).toBe('Garden Club')
    expect(meta.description).toBe(null)
    expect(meta.imageUrl).toBe('https://cdn.example/banner.jpg')
  })

  it('leaves the description out for a public group with no description or purpose', () => {
    const meta = presentGroupMeta({ ...publicGroup, description: null, purpose: '' })
    expect(meta.description).toBe(null)
  })

  it('skips the default svg images', () => {
    const meta = presentGroupMeta({ ...publicGroup, bannerUrl: '/default-group-banner.svg', avatarUrl: '/default-group-avatar.svg' })
    expect(meta.imageUrl).toBe(null)
  })

  it('returns null without a group', () => {
    expect(presentGroupMeta(null)).toBe(null)
  })
})

describe('fetchGroupMeta', () => {
  it('passes the access code with the slug', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: publicGroup }))
    await fetchGroupMeta({ slug: 'garden-club', accessCode: 'abc123' }, { fetchImpl, apiHost: API })
    const body = JSON.parse(fetchImpl.mock.calls[0][1].body)
    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/noo/graphql')
    expect(body.variables).toEqual({ slug: 'garden-club', accessCode: 'abc123' })
  })

  it('looks up the group of an invitation token before fetching it', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(graphqlResponse({ checkInvitation: { valid: true, groupSlug: 'garden-club' } }))
      .mockResolvedValueOnce(graphqlResponse({ group: { ...publicGroup, visibility: 0 } }))
    const meta = await fetchGroupMeta({ invitationToken: 'tok' }, { fetchImpl, apiHost: API })
    expect(JSON.parse(fetchImpl.mock.calls[1][1].body).variables).toEqual({ slug: 'garden-club', invitationToken: 'tok' })
    expect(meta.title).toBe('Garden Club')
    expect(meta.description).toBe(null)
  })

  it('returns null for an invalid invitation token', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ checkInvitation: { valid: false } }))
    expect(await fetchGroupMeta({ invitationToken: 'used' }, { fetchImpl, apiHost: API })).toBe(null)
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('withGroupMetaTags', () => {
  it('injects tags for a public group page', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: publicGroup }))
    const result = await withGroupMetaTags(HTML, request('/groups/garden-club/about'), { fetchImpl, apiHost: API })

    expect(result).toContain('<title>Garden Club</title>')
    expect(result).toContain('<meta property="og:type" content="website" />')
    expect(result).toContain('<meta property="og:description" content="We grow food together." />')
    expect(result).toContain('<meta property="og:image" content="https://cdn.example/banner.jpg" />')
    expect(result).toContain('<meta property="og:url" content="https://hylo.com/groups/garden-club/about" />')
    expect(result).toContain('<meta name="twitter:card" content="summary_large_image" />')
    expect(result).not.toMatch(/<title>Hylo<\/title>/)
  })

  it('leaves the page alone for a group that is not public and no code', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: null }))
    const result = await withGroupMetaTags(HTML, request('/groups/secret-club'), { fetchImpl, apiHost: API })
    expect(result).toBe(HTML)
  })

  it('gives a join link for a group that is not public a title and image but no description', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: { ...publicGroup, visibility: 1 } }))
    const result = await withGroupMetaTags(HTML, request('/groups/garden-club/join/abc123'), { fetchImpl, apiHost: API })

    expect(result).toContain('<meta property="og:title" content="Garden Club" />')
    expect(result).toContain('og:image')
    expect(result).not.toContain('description')
  })

  it('leaves the invitation token out of the page url', async () => {
    const fetchImpl = jest.fn()
      .mockResolvedValueOnce(graphqlResponse({ checkInvitation: { valid: true, groupSlug: 'garden-club' } }))
      .mockResolvedValueOnce(graphqlResponse({ group: publicGroup }))
    const result = await withGroupMetaTags(HTML, request('/h/use-invitation?token=tok', { token: 'tok' }), { fetchImpl, apiHost: API })

    expect(result).toContain('og:title')
    expect(result).not.toContain('og:url')
    expect(result).not.toContain('tok')
  })

  it('falls back to the Hylo logo when the group has no image of its own', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: { ...publicGroup, bannerUrl: null, avatarUrl: null } }))
    const result = await withGroupMetaTags(HTML, request('/groups/garden-club'), { fetchImpl, apiHost: API })

    expect(result).toContain('<meta property="og:image" content="https://hylo.com/hylo-merkaba.png" />')
    expect(result).toContain('<meta name="twitter:card" content="summary" />')
  })

  it('escapes group fields', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({
      group: { ...publicGroup, name: 'Say "hi" <script>', description: 'A & B' }
    }))
    const result = await withGroupMetaTags(HTML, request('/groups/garden-club'), { fetchImpl, apiHost: API })

    expect(result).toContain('content="Say &quot;hi&quot; &lt;script&gt;"')
    expect(result).toContain('content="A &amp; B"')
    expect(result).not.toContain('<script>')
  })

  it('leaves the html unchanged when the API cannot be reached, and tries again next time', async () => {
    const fetchImpl = jest.fn().mockRejectedValueOnce(new Error('offline'))
    jest.spyOn(console, 'error').mockImplementation(() => {})
    const result = await withGroupMetaTags(HTML, request('/groups/garden-club'), { fetchImpl, apiHost: API })
    expect(result).toBe(HTML)

    fetchImpl.mockResolvedValueOnce(graphqlResponse({ group: publicGroup }))
    const retried = await withGroupMetaTags(HTML, request('/groups/garden-club'), { fetchImpl, apiHost: API })
    expect(retried).toContain('og:title')
    console.error.mockRestore()
  })

  it('reuses one lookup for every page of a group', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(graphqlResponse({ group: publicGroup }))
    await withGroupMetaTags(HTML, request('/groups/garden-club'), { fetchImpl, apiHost: API })
    await withGroupMetaTags(HTML, request('/groups/garden-club/members'), { fetchImpl, apiHost: API })
    expect(fetchImpl).toHaveBeenCalledTimes(1)
  })
})

describe('withDefaultMetaTags', () => {
  it('adds Hylo tags to a page without any', () => {
    const result = withDefaultMetaTags(HTML, request('/my/posts'))
    expect(result).toContain('<meta property="og:site_name" content="Hylo" />')
    expect(result).toContain('<meta property="og:title" content="Hylo" />')
    expect(result).toContain('<meta property="og:image" content="https://hylo.com/hylo-merkaba.png" />')
    expect(result.match(/<title>/g).length).toBe(1)
  })

  it('leaves a page that already has preview tags alone', () => {
    const tagged = '<html><head><meta property="og:title" content="Garden Club" /></head></html>'
    expect(withDefaultMetaTags(tagged, request('/groups/garden-club'))).toBe(tagged)
  })

  describe('description', () => {
    const EN = 'Hylo is the prosocial coordination platform for purpose-driven groups'
    const withLanguage = (header) => ({
      ...request('/my/posts'),
      get: name => ({ host: 'hylo.com', 'accept-language': header })[name]
    })

    beforeEach(() => resetDefaultPreviewDescriptions())
    afterAll(() => resetDefaultPreviewDescriptions())

    it('carries the homepage line in English by default', () => {
      const result = withDefaultMetaTags(HTML, request('/my/posts'))
      expect(result).toContain(`<meta name="description" content="${EN}" />`)
      expect(result).toContain(`<meta property="og:description" content="${EN}" />`)
      expect(result).toContain(`<meta name="twitter:description" content="${EN}" />`)
    })

    it('uses the language the request asks for', () => {
      const result = withDefaultMetaTags(HTML, withLanguage('es-MX,es;q=0.9,en;q=0.5'))
      expect(result).toContain('<meta property="og:description" content="Hylo es la plataforma de coordinación prosocial para grupos con propósito" />')
    })

    it('falls back to English for a language Hylo does not have', () => {
      const result = withDefaultMetaTags(HTML, withLanguage('ja-JP'))
      expect(result).toContain(`<meta property="og:description" content="${EN}" />`)
    })

    it('escapes the description', () => {
      const readString = () => 'Groups "that" <care> & share'
      const result = withDefaultMetaTags(HTML, request('/my/posts'), { readString })
      expect(result).toContain('<meta property="og:description" content="Groups &quot;that&quot; &lt;care&gt; &amp; share" />')
    })

    it("isn't added when the page has more specific preview tags", () => {
      const tagged = '<html><head><meta property="og:title" content="Garden Club" /><meta name="description" content="Grow food" /></head></html>'
      const result = withDefaultMetaTags(tagged, request('/groups/garden-club'))
      expect(result).toBe(tagged)
      expect(result).not.toContain(EN)
    })

    it('leaves out the description when no locale file has it', () => {
      const result = withDefaultMetaTags(HTML, request('/my/posts'), { readString: () => null })
      expect(result).not.toContain('og:description')
      expect(result).toContain('<meta property="og:title" content="Hylo" />')
    })
  })
})

describe('localeFromAcceptLanguage', () => {
  it('reads the preferred supported language by quality and order', () => {
    expect(localeFromAcceptLanguage('fr-CH, fr;q=0.9, en;q=0.8, de;q=0.7, *;q=0.5')).toBe('fr')
    expect(localeFromAcceptLanguage('ja;q=1, pt-BR;q=0.8, de;q=0.9')).toBe('de')
    expect(localeFromAcceptLanguage('hi-IN')).toBe('hi')
  })

  it('falls back to English', () => {
    expect(localeFromAcceptLanguage('')).toBe('en')
    expect(localeFromAcceptLanguage(undefined)).toBe('en')
    expect(localeFromAcceptLanguage('ja, zh;q=0.5')).toBe('en')
    expect(localeFromAcceptLanguage('de;q=0')).toBe('en')
  })
})

describe('defaultPreviewDescription', () => {
  beforeEach(() => resetDefaultPreviewDescriptions())
  afterAll(() => resetDefaultPreviewDescriptions())

  it('has the line in all six languages', () => {
    for (const locale of ['en', 'de', 'es', 'fr', 'hi', 'pt']) {
      expect(defaultPreviewDescription(locale)).toMatch(/Hylo/)
    }
  })

  it('falls back to English when a language is missing the line', () => {
    const readString = (locale) => locale === 'en' ? 'English line' : null
    expect(defaultPreviewDescription('de', { readString })).toBe('English line')
  })
})
