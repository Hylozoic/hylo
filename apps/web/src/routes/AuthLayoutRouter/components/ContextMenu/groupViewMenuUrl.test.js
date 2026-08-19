import { isDrawerNavLayout } from 'util/mobile'
import { externalLinkHref, spaceEntryUrl } from './groupViewMenuUrl'

jest.mock('util/mobile', () => ({
  isDrawerNavLayout: jest.fn(() => false)
}))

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

describe('spaceEntryUrl', () => {
  const space = { slug: 'parent-space', homeRoute: '/welcome' }

  afterEach(() => {
    isDrawerNavLayout.mockReturnValue(false)
  })

  it('returns the space home view when a sidebar menu is visible', () => {
    expect(spaceEntryUrl('parent', space)).toBe('/groups/parent/spaces/space/welcome')
  })

  it('returns the space index on a drawer layout so the space menu can show', () => {
    isDrawerNavLayout.mockReturnValue(true)
    expect(spaceEntryUrl('parent', space)).toBe('/groups/parent/spaces/space')
  })

  it('falls back to the parent group when the space is missing', () => {
    expect(spaceEntryUrl('parent', null)).toBe('/groups/parent')
  })
})
