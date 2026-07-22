import {
  categorizeOffMenuSpaces,
  categorizeOffMenuSpacesForEdit,
  getMenuSpaceIds
} from './getMoreSpacesSections'

describe('getMenuSpaceIds', () => {
  it('collects linked space ids from menu views', () => {
    const ids = getMenuSpaceIds([
      { type: 'space', linkedGroup: { id: '1' } },
      { type: 'all' },
      { type: 'space', linkedGroup: { id: '2' } }
    ])
    expect([...ids]).toEqual(['1', '2'])
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

describe('categorizeOffMenuSpacesForEdit', () => {
  const menuSpaceIds = new Set(['10'])

  it('groups draft and archived off-menu spaces only', () => {
    const result = categorizeOffMenuSpacesForEdit([
      { id: '10', name: 'In menu', active: true },
      { id: '11', name: 'Live FR', active: true, fundingRound: { id: 'r1', publishedAt: '2020-01-01' } },
      { id: '12', name: 'Draft track', active: true, track: { id: 't1', publishedAt: null } },
      { id: '13', name: 'Live track', active: true, track: { id: 't2', publishedAt: '2020-01-01' } },
      { id: '14', name: 'Other space', active: true },
      { id: '15', name: 'Archived track', active: false, track: { id: 't3', publishedAt: '2020-01-01' } },
      { id: '16', name: 'Draft FR', active: true, fundingRound: { id: 'r2', publishedAt: null } },
      { id: '17', name: 'Archived FR', active: false, fundingRound: { id: 'r3', publishedAt: '2020-01-01' } },
      { id: '18', name: 'Other archived', active: false }
    ], menuSpaceIds)

    expect(result.draftTracks.map(s => s.id)).toEqual(['12'])
    expect(result.archivedTracks.map(s => s.id)).toEqual(['15'])
    expect(result.draftFundingRounds.map(s => s.id)).toEqual(['16'])
    expect(result.archivedFundingRounds.map(s => s.id)).toEqual(['17'])
    expect(result.otherArchivedSpaces.map(s => s.id)).toEqual(['18'])
  })
})
