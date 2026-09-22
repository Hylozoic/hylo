/* eslint-env jest */
import {
  extractPostIdFromPath,
  escapeHtmlAttr,
  buildPostMetaTagHtml,
  injectPostMetaTagsIntoHtml,
  presentPublicPostMeta,
  fetchPublicPostMeta,
  withPublicPostMetaTags
} from './postMetaTags'

describe('extractPostIdFromPath', () => {
  it('reads the post id from common Hylo post paths', () => {
    expect(extractPostIdFromPath('/post/42')).toBe('42')
    expect(extractPostIdFromPath('/public/post/99')).toBe('99')
    expect(extractPostIdFromPath('/groups/building-hylo/post/7')).toBe('7')
    expect(extractPostIdFromPath('/groups/foo/all/post/12?commentId=1')).toBe('12')
  })

  it('returns null when the path is not a post', () => {
    expect(extractPostIdFromPath('/groups/building-hylo')).toBe(null)
    expect(extractPostIdFromPath('/post/create')).toBe(null)
    expect(extractPostIdFromPath('')).toBe(null)
  })
})

describe('escapeHtmlAttr', () => {
  it('escapes quotes and tags', () => {
    expect(escapeHtmlAttr('Say "hi" <em>now</em>')).toBe('Say &quot;hi&quot; &lt;em&gt;now&lt;/em&gt;')
  })
})

describe('presentPublicPostMeta', () => {
  it('uses title, stripped body, and the first image attachment', () => {
    const meta = presentPublicPostMeta({
      title: 'Garden day',
      details: '<p>Come help <strong>plant</strong> trees.</p>',
      attachments: [
        { type: 'file', url: 'https://cdn.example/doc.pdf', position: 0 },
        { type: 'image', url: 'https://cdn.example/second.jpg', position: 2 },
        { type: 'image', url: 'https://cdn.example/first.jpg', position: 1 }
      ]
    })

    expect(meta.title).toBe('Garden day')
    expect(meta.description).toContain('Come help plant trees')
    expect(meta.imageUrl).toBe('https://cdn.example/first.jpg')
  })

  it('falls back to body text when the post has no title', () => {
    const meta = presentPublicPostMeta({
      title: '',
      details: '<p>Just a note</p>',
      attachments: []
    })

    expect(meta.title).toBe('Just a note')
    expect(meta.imageUrl).toBe(null)
  })

  it('returns null without a post', () => {
    expect(presentPublicPostMeta(null)).toBe(null)
  })
})

describe('buildPostMetaTagHtml / injectPostMetaTagsIntoHtml', () => {
  it('injects og title, description, and image', () => {
    const metaHtml = buildPostMetaTagHtml({
      title: 'Garden day',
      description: 'Come help plant trees.',
      imageUrl: 'https://cdn.example/first.jpg',
      url: 'https://hylo.com/post/42'
    })
    const html = injectPostMetaTagsIntoHtml(
      '<html><head><title>Hylo</title></head><body></body></html>',
      metaHtml
    )

    expect(html).toContain('og:title')
    expect(html).toContain('Garden day')
    expect(html).toContain('Come help plant trees.')
    expect(html).toContain('og:image')
    expect(html).toContain('https://cdn.example/first.jpg')
    expect(html).toContain('twitter:card')
    expect(html).toContain('summary_large_image')
    expect(html).not.toMatch(/<title>Hylo<\/title>/)
  })
})

describe('fetchPublicPostMeta', () => {
  it('returns presented fields from a public GraphQL post', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          post: {
            id: '42',
            title: 'Garden day',
            details: '<p>Hello</p>',
            attachments: [{ type: 'image', url: 'https://cdn.example/a.jpg', position: 0 }]
          }
        }
      })
    })

    const meta = await fetchPublicPostMeta('42', { fetchImpl, apiHost: 'http://api.test' })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/noo/graphql',
      expect.objectContaining({ method: 'POST' })
    )
    expect(meta.title).toBe('Garden day')
    expect(meta.imageUrl).toBe('https://cdn.example/a.jpg')
  })

  it('returns null when the post is not public (GraphQL returns null)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { post: null } })
    })

    expect(await fetchPublicPostMeta('99', { fetchImpl, apiHost: 'http://api.test' })).toBe(null)
  })
})

describe('withPublicPostMetaTags', () => {
  it('leaves HTML unchanged for non-post routes', async () => {
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicPostMetaTags(html, { url: '/groups/foo' })
    expect(result).toBe(html)
  })

  it('injects tags when a public post is found', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          post: {
            id: '42',
            title: 'Garden day',
            details: '<p>Hello</p>',
            attachments: []
          }
        }
      })
    })
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicPostMetaTags(
      html,
      { originalUrl: '/post/42', protocol: 'https', get: () => 'hylo.com' },
      { fetchImpl, apiHost: 'http://api.test' }
    )

    expect(result).toContain('og:title')
    expect(result).toContain('Garden day')
  })
})
