import {
  filterSpaceViewsForMenuVisibility,
  filterSpacesForMenuVisibility,
  shouldShowPaywalledSpaceInMenu,
  spaceIdsGrantedByPublishedOfferings
} from './paidSpaceVisibility'

describe('paidSpaceVisibility', () => {
  const offerings = [
    { publishStatus: 'published', accessGrants: { groupIds: [101] } },
    { publishStatus: 'unpublished', accessGrants: { groupIds: [202] } }
  ]

  it('collects space ids from published offerings only', () => {
    expect([...spaceIdsGrantedByPublishedOfferings(offerings)]).toEqual(['101'])
  })

  it('shows non-paywalled spaces', () => {
    expect(shouldShowPaywalledSpaceInMenu({ id: 1, paywall: false }, {
      grantedSpaceIds: new Set(),
      canManageSpaces: false
    })).toBe(true)
  })

  it('hides paywalled spaces without offerings for non-managers', () => {
    expect(shouldShowPaywalledSpaceInMenu({ id: 202, paywall: true }, {
      grantedSpaceIds: spaceIdsGrantedByPublishedOfferings(offerings),
      canManageSpaces: false
    })).toBe(false)
  })

  it('shows paywalled spaces with offerings', () => {
    expect(shouldShowPaywalledSpaceInMenu({ id: 101, paywall: true }, {
      grantedSpaceIds: spaceIdsGrantedByPublishedOfferings(offerings),
      canManageSpaces: false
    })).toBe(true)
  })

  it('shows paywalled spaces to managers without offerings', () => {
    expect(shouldShowPaywalledSpaceInMenu({ id: 202, paywall: true }, {
      grantedSpaceIds: new Set(),
      canManageSpaces: true
    })).toBe(true)
  })

  it('filters space menu views', () => {
    const views = [
      { type: 'all' },
      { type: 'space', linkedGroup: { id: 101, paywall: true } },
      { type: 'space', linkedGroup: { id: 202, paywall: true } }
    ]
    const filtered = filterSpaceViewsForMenuVisibility(views, {
      offerings,
      canManageSpaces: false
    })
    expect(filtered.map(v => v.type === 'space' ? v.linkedGroup.id : v.type)).toEqual(['all', 101])
  })

  it('filters space lists', () => {
    const spaces = [
      { id: 101, paywall: true },
      { id: 202, paywall: true },
      { id: 303, paywall: false }
    ]
    expect(filterSpacesForMenuVisibility(spaces, { offerings, canManageSpaces: false }).map(s => s.id))
      .toEqual([101, 303])
  })
})
