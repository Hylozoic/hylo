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
      { id: '10', name: 'In menu', active: true, status: 'published' },
      { id: '11', name: 'Round', active: true, status: 'published', fundingRound: { id: 'r1' } },
      { id: '12', name: 'Draft track', active: true, status: 'draft', track: { id: 't1' } },
      { id: '13', name: 'Live track', active: true, status: 'published', track: { id: 't2' } },
      { id: '14', name: 'Other space', active: true, status: 'published' },
      { id: '15', name: 'Archived', active: true, status: 'archived', track: { id: 't3' } },
      { id: '16', name: 'Deleted', active: false, status: 'published' }
    ], menuSpaceIds)

    expect(result.fundingRoundSpaces.map(s => s.id)).toEqual(['11'])
    expect(result.draftSpaces.map(s => s.id)).toEqual(['12'])
    expect(result.draftSpaces[0].isDraft).toBe(true)
    expect(result.trackSpaces.map(s => s.id)).toEqual(['13'])
    expect(result.trackSpaces[0].isDraft).toBe(false)
    expect(result.otherSpaces.map(s => s.id)).toEqual(['14'])
    expect(result.archivedSpaces.map(s => s.id)).toEqual(['15'])
  })
})
