import { isDrawerNavLayout } from 'util/mobile'
import { externalLinkHref, groupViewUrl, isParentGroupPath, spaceEntryUrl } from './groupViewMenuUrl'

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

  it('uses a track space home view when homeRoute is missing', () => {
    const trackSpace = { slug: 'parent-track', track: { id: '1' } }
    expect(spaceEntryUrl('parent', trackSpace)).toBe('/groups/parent/spaces/track/track-actions')
  })

  it('uses the order-0 view when homeRoute is stale', () => {
    const trackSpace = {
      slug: 'parent-track',
      homeRoute: '/all',
      groupViews: { items: [{ type: 'track-actions', order: 0 }, { type: 'chat', order: 1 }] }
    }
    expect(spaceEntryUrl('parent', trackSpace)).toBe('/groups/parent/spaces/track/track-actions')
  })

  it('falls back to the parent group when the space is missing', () => {
    expect(spaceEntryUrl('parent', null)).toBe('/groups/parent')
  })
})

describe('isParentGroupPath', () => {
  it('matches the group home and group views', () => {
    expect(isParentGroupPath('/groups/foo', 'foo')).toBe(true)
    expect(isParentGroupPath('/groups/foo/all', 'foo')).toBe(true)
    expect(isParentGroupPath('/groups/foo/more-spaces', 'foo')).toBe(true)
  })

  it('rejects nested spaces and other groups', () => {
    expect(isParentGroupPath('/groups/foo/spaces/bar', 'foo')).toBe(false)
    expect(isParentGroupPath('/groups/foo/spaces/bar/chat', 'foo')).toBe(false)
    expect(isParentGroupPath('/groups/other/all', 'foo')).toBe(false)
    expect(isParentGroupPath('/all', 'foo')).toBe(false)
  })
})

describe('groupViewUrl', () => {
  it('includes the view id for space-collection routes', () => {
    expect(groupViewUrl('building-hylo', { type: 'space-collection', id: '99' }))
      .toBe('/groups/building-hylo/space-collection/99')
  })
})
