jest.mock('util/mobile', () => ({
  isPhoneDevice: jest.fn(() => false)
}))

import { isPhoneDevice } from 'util/mobile'
import { getPostDetailCloseDestination, memberGroupIdsFromMe, shouldUseSmartPostClose } from './postDetailCloseNavigation'

function meWithGroups (groupIds) {
  return {
    memberships: {
      toModelArray: () => groupIds.map(id => ({ group: { id } }))
    }
  }
}

describe('memberGroupIdsFromMe', () => {
  it('returns empty when me is missing', () => {
    expect(memberGroupIdsFromMe(null)).toEqual([])
  })
})

describe('getPostDetailCloseDestination', () => {
  const base = { pathname: '/post/99', search: '?x=1' }

  it('single group + member → group stream', () => {
    const me = meWithGroups(['10'])
    const post = { isPublic: true, groups: [{ id: '10', slug: 'alpha' }] }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/groups/alpha/stream',
      search: ''
    })
  })

  it('single group + not a member + public → /public/stream', () => {
    const me = meWithGroups([])
    const post = { isPublic: true, groups: [{ id: '10', slug: 'alpha' }] }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/public/stream',
      search: ''
    })
  })

  it('many groups + member of none + public → /public/stream', () => {
    const me = meWithGroups([])
    const post = {
      isPublic: true,
      groups: [{ id: '1', slug: 'a' }, { id: '2', slug: 'b' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/public/stream',
      search: ''
    })
  })

  it('many groups + member of none + not public → /my/groups', () => {
    const me = meWithGroups([])
    const post = {
      isPublic: false,
      groups: [{ id: '1', slug: 'a' }, { id: '2', slug: 'b' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/my/groups',
      search: ''
    })
  })

  it('many groups + member of exactly one → that group stream', () => {
    const me = meWithGroups(['10', '99'])
    const post = {
      isPublic: true,
      groups: [{ id: '10', slug: 'in' }, { id: '20', slug: 'out' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/groups/in/stream',
      search: ''
    })
  })

  it('many groups + member of several post groups → /my/groups', () => {
    const me = meWithGroups(['10', '20'])
    const post = {
      isPublic: true,
      groups: [{ id: '10', slug: 'a' }, { id: '20', slug: 'b' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/my/groups',
      search: ''
    })
  })

  it('falls back to stripped path when post has no groups', () => {
    expect(getPostDetailCloseDestination({ ...base, post: { groups: [] }, me: meWithGroups([]) })).toEqual({
      pathname: '/',
      search: '?x=1'
    })
  })
})

describe('shouldUseSmartPostClose', () => {
  beforeEach(() => {
    isPhoneDevice.mockReturnValue(false)
  })

  it('is true for isolated /post/:id view on desktop', () => {
    expect(shouldUseSmartPostClose('post')).toBe(true)
  })

  it('is true for in-context view on phone', () => {
    isPhoneDevice.mockReturnValue(true)
    expect(shouldUseSmartPostClose('stream')).toBe(true)
  })

  it('is false for in-context view on desktop', () => {
    expect(shouldUseSmartPostClose('stream')).toBe(false)
  })
})
