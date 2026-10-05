/* eslint-env jest */
import {
  extractGroupSlugFromPath,
  buildGroupMetaTagHtml,
  presentPublicGroupMeta,
  fetchPublicGroupMeta,
  withPublicGroupMetaTags
} from './groupMetaTags'
import { injectPostMetaTagsIntoHtml } from './postMetaTags'

describe('extractGroupSlugFromPath', () => {
  it('reads the group slug from common Hylo group paths', () => {
    expect(extractGroupSlugFromPath('/groups/building-hylo')).toBe('building-hylo')
    expect(extractGroupSlugFromPath('/groups/building-hylo/about')).toBe('building-hylo')
    expect(extractGroupSlugFromPath('/groups/foo/all?sort=latest')).toBe('foo')
  })

  it('resolves a nested space to its stored parent-local slug', () => {
    expect(extractGroupSlugFromPath('/groups/building-hylo/spaces/garden')).toBe('building-hylo-garden')
    expect(extractGroupSlugFromPath('/groups/building-hylo/spaces/garden/all')).toBe('building-hylo-garden')
  })

  it('returns null when the path is not a group', () => {
    expect(extractGroupSlugFromPath('/public/groups')).toBe(null)
    expect(extractGroupSlugFromPath('/groups')).toBe(null)
    expect(extractGroupSlugFromPath('/post/42')).toBe(null)
    expect(extractGroupSlugFromPath('')).toBe(null)
  })
})

describe('presentPublicGroupMeta', () => {
  it('uses name | Hylo, purpose, and avatar', () => {
    const meta = presentPublicGroupMeta({
      name: 'Building Hylo',
      purpose: 'Coordinate **community** work.',
      description: 'A longer description that should be ignored.',
      avatarUrl: 'https://cdn.example/avatar.jpg',
      visibility: 2
    })

    expect(meta.title).toBe('Building Hylo | Hylo')
    expect(meta.description).toContain('Coordinate community work')
    expect(meta.imageUrl).toBe('https://cdn.example/avatar.jpg')
  })

  it('falls back to description when the group has no purpose', () => {
    const meta = presentPublicGroupMeta({
      name: 'Gardeners',
      purpose: '',
      description: 'We grow *food* together.',
      avatarUrl: null,
      visibility: 2
    })

    expect(meta.description).toContain('We grow food together')
    expect(meta.imageUrl).toBe(null)
  })

  it('returns null without a group or for non-public visibility', () => {
    expect(presentPublicGroupMeta(null)).toBe(null)
    expect(presentPublicGroupMeta({
      name: 'Hidden',
      purpose: 'Secret',
      visibility: 0
    })).toBe(null)
  })
})

describe('buildGroupMetaTagHtml', () => {
  it('injects og title, description, and avatar image', () => {
    const metaHtml = buildGroupMetaTagHtml({
      title: 'Building Hylo | Hylo',
      description: 'Coordinate community work.',
      imageUrl: 'https://cdn.example/avatar.jpg',
      url: 'https://hylo.com/groups/building-hylo'
    })
    const html = injectPostMetaTagsIntoHtml(
      '<html><head><title>Hylo</title></head><body></body></html>',
      metaHtml
    )

    expect(html).toContain('og:title')
    expect(html).toContain('Building Hylo | Hylo')
    expect(html).toContain('Coordinate community work.')
    expect(html).toContain('og:image')
    expect(html).toContain('https://cdn.example/avatar.jpg')
    expect(html).toContain('og:type')
    expect(html).toContain('website')
    expect(html).toContain('twitter:card')
    expect(html).toContain('summary')
    expect(html).not.toMatch(/<title>Hylo<\/title>/)
  })
})

describe('fetchPublicGroupMeta', () => {
  it('returns presented fields from a public GraphQL group', async () => {
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

    const meta = await fetchPublicGroupMeta('building-hylo', { fetchImpl, apiHost: 'http://api.test' })

    expect(fetchImpl).toHaveBeenCalledWith(
      'http://api.test/noo/graphql',
      expect.objectContaining({ method: 'POST' })
    )
    expect(meta.title).toBe('Building Hylo | Hylo')
    expect(meta.imageUrl).toBe('https://cdn.example/a.jpg')
  })

  it('returns null when the group is not public (GraphQL returns null)', async () => {
    const fetchImpl = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ data: { group: null } })
    })

    expect(await fetchPublicGroupMeta('hidden', { fetchImpl, apiHost: 'http://api.test' })).toBe(null)
  })
})

describe('withPublicGroupMetaTags', () => {
  it('leaves HTML unchanged for non-group routes', async () => {
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicGroupMetaTags(html, { url: '/public' })
    expect(result).toBe(html)
  })

  it('leaves HTML unchanged for post routes so post tags win', async () => {
    const html = '<html><head><title>Hylo</title></head></html>'
    const result = await withPublicGroupMetaTags(html, { url: '/groups/foo/post/42' })
    expect(result).toBe(html)
  })

  it('injects tags when a public group is found', async () => {
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
    const result = await withPublicGroupMetaTags(
      html,
      { originalUrl: '/groups/building-hylo', protocol: 'https', get: () => 'hylo.com' },
      { fetchImpl, apiHost: 'http://api.test' }
    )

    expect(result).toContain('og:title')
    expect(result).toContain('Building Hylo | Hylo')
    expect(result).toContain('Build tools for communities')
    expect(result).toContain('https://cdn.example/a.jpg')
  })
})
