import { isPhoneDevice } from 'util/mobile'
import { closePostOverlay, getPostDetailCloseDestination, isPostOverlayAbovePrevious, memberGroupIdsFromMe, shouldUseSmartPostClose } from './postDetailCloseNavigation'

jest.mock('util/mobile', () => ({
  isPhoneDevice: jest.fn(() => false)
}))

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

  it('single group + member → group all view', () => {
    const me = meWithGroups(['10'])
    const post = { isPublic: true, groups: [{ id: '10', slug: 'alpha' }] }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/groups/alpha/all',
      search: ''
    })
  })

  it('single group + not a member + public → /public/all', () => {
    const me = meWithGroups([])
    const post = { isPublic: true, groups: [{ id: '10', slug: 'alpha' }] }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/public/all',
      search: ''
    })
  })

  it('many groups + member of none + public → /public/all', () => {
    const me = meWithGroups([])
    const post = {
      isPublic: true,
      groups: [{ id: '1', slug: 'a' }, { id: '2', slug: 'b' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/public/all',
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

  it('many groups + member of exactly one → that group all view', () => {
    const me = meWithGroups(['10', '99'])
    const post = {
      isPublic: true,
      groups: [{ id: '10', slug: 'in' }, { id: '20', slug: 'out' }]
    }
    expect(getPostDetailCloseDestination({ ...base, post, me })).toEqual({
      pathname: '/groups/in/all',
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
    expect(shouldUseSmartPostClose('all')).toBe(true)
  })

  it('is false for in-context view on desktop', () => {
    expect(shouldUseSmartPostClose('all')).toBe(false)
  })
})

describe('isPostOverlayAbovePrevious', () => {
  it('is true when the previous page is the same route without the post', () => {
    expect(isPostOverlayAbovePrevious(
      '/groups/foo/members/5/post/99',
      { pathname: '/groups/foo/members/5' }
    )).toBe(true)
  })

  it('ignores trailing slashes', () => {
    expect(isPostOverlayAbovePrevious(
      '/groups/foo/members/5/post/99/',
      { pathname: '/groups/foo/members/5/' }
    )).toBe(true)
  })

  it('is false when the post was opened from somewhere else', () => {
    expect(isPostOverlayAbovePrevious(
      '/groups/foo/members/5/post/99',
      { pathname: '/groups/foo/all' }
    )).toBe(false)
  })
})

describe('closePostOverlay', () => {
  it('pops when the post was opened on top of the current page', () => {
    const navigate = jest.fn()
    closePostOverlay({
      navigate,
      pathname: '/groups/foo/members/5/post/99',
      search: '?t=1',
      previousLocation: { pathname: '/groups/foo/members/5', search: '?t=1' },
      canGoBack: true
    })
    expect(navigate).toHaveBeenCalledWith(-1)
  })

  it('replaces the post entry when it was not opened from the parent page', () => {
    const navigate = jest.fn()
    closePostOverlay({
      navigate,
      pathname: '/groups/foo/members/5/post/99',
      search: '',
      hash: '',
      previousLocation: { pathname: '/groups/foo/all' },
      canGoBack: true
    })
    expect(navigate).toHaveBeenCalledWith(
      { pathname: '/groups/foo/members/5', search: '', hash: '' },
      { replace: true }
    )
  })

  it('does not pop off the site when history cannot go back', () => {
    const navigate = jest.fn()
    closePostOverlay({
      navigate,
      pathname: '/groups/foo/members/5/post/99',
      previousLocation: { pathname: '/groups/foo/members/5' },
      canGoBack: false
    })
    expect(navigate).toHaveBeenCalledWith(
      { pathname: '/groups/foo/members/5', search: '', hash: '' },
      { replace: true }
    )
  })
})
