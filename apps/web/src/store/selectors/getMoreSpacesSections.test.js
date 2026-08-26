import {
  categorizeOffMenuSpaces,
  getMenuSpaceIds
} from './getMoreSpacesSections'

describe('getMenuSpaceIds', () => {
  it('collects linked space ids from ordered menu views only', () => {
    const ids = getMenuSpaceIds([
      { type: 'space', order: 1, linkedGroup: { id: '1' } },
      { type: 'all', order: 0 },
      { type: 'space', order: null, linkedGroup: { id: '2' } },
      { type: 'space', order: 2, linkedGroup: { id: '3' } }
    ])
    expect([...ids].sort()).toEqual(['1', '3'])
  })
})

describe('categorizeOffMenuSpaces', () => {
  const menuSpaceIds = new Set(['10'])

  it('groups off-menu spaces by type', () => {
    const result = categorizeOffMenuSpaces([
      { id: '10', name: 'In menu', active: true },
      { id: '11', name: 'Round', active: true, fundingRound: { id: 'r1', title: 'Round' } },
      { id: '12', name: 'Draft track', active: true, track: { id: 't1', publishedAt: null } },
      { id: '13', name: 'Live track', active: true, track: { id: 't2', publishedAt: '2020-01-01' } },
      { id: '14', name: 'Other space', active: true },
      { id: '15', name: 'Archived', active: false, track: { id: 't3', publishedAt: '2020-01-01' } }
    ], menuSpaceIds)

    expect(result.fundingRoundSpaces.map(s => s.id)).toEqual(['11'])
    expect(result.trackSpaces.map(s => s.id)).toEqual(['12', '13'])
    expect(result.trackSpaces.find(s => s.id === '12').isDraft).toBe(true)
    expect(result.trackSpaces.find(s => s.id === '13').isDraft).toBe(false)
    expect(result.otherSpaces.map(s => s.id)).toEqual(['14'])
    expect(result.archivedSpaces.map(s => s.id)).toEqual(['15'])
  })
})
