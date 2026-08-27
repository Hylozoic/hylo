import {
  appendSpaceId,
  parseViewSettings,
  removeSpaceId,
  reorderVisibleSpaceIds,
  resolveSpacesByIds,
  collectionsWithoutSpace,
  spaceCollectionViews,
  spaceIdsFromSettings,
  withSpaceIds
} from './spaceCollection'

describe('spaceCollection helpers', () => {
  it('parses settings from an object or JSON string', () => {
    expect(parseViewSettings({ spaceIds: ['1'] })).toEqual({ spaceIds: ['1'] })
    expect(parseViewSettings('{"spaceIds":["2"]}')).toEqual({ spaceIds: ['2'] })
    expect(parseViewSettings(null)).toEqual({})
    expect(parseViewSettings('not-json')).toEqual({})
  })

  it('reads ordered space ids as strings', () => {
    expect(spaceIdsFromSettings({ spaceIds: [1, '2'] })).toEqual(['1', '2'])
    expect(spaceIdsFromSettings({})).toEqual([])
  })

  it('appends and removes space ids without duplicating', () => {
    const added = appendSpaceId({ spaceIds: ['1'], migratedFrom: 'tracks' }, 2)
    expect(added).toEqual({ spaceIds: ['1', '2'], migratedFrom: 'tracks' })
    expect(appendSpaceId(added, '1').spaceIds).toEqual(['1', '2'])
    expect(removeSpaceId(added, 2).spaceIds).toEqual(['1'])
  })

  it('replaces spaceIds while preserving other settings', () => {
    expect(withSpaceIds({ migratedFrom: 'tracks' }, [3])).toEqual({
      migratedFrom: 'tracks',
      spaceIds: ['3']
    })
  })

  it('resolves spaces in stored order and drops missing ids', () => {
    const spaces = [
      { id: '10', name: 'Later', status: 'draft', track: { id: 't1' } },
      { id: '9', name: 'First' }
    ]
    const resolved = resolveSpacesByIds(spaces, ['9', '99', '10'])
    expect(resolved.map(s => s.id)).toEqual(['9', '10'])
    expect(resolved[1].isDraft).toBe(true)
    expect(resolved[0].isDraft).toBe(false)
  })

  it('filters space-collection views from a menu list', () => {
    const views = [
      { id: '1', type: 'all' },
      { id: '2', type: 'space-collection', name: 'Tracks' }
    ]
    expect(spaceCollectionViews(views).map(v => v.id)).toEqual(['2'])
    expect(spaceCollectionViews({ items: views })).toHaveLength(1)
  })

  it('omits collections that already contain the space', () => {
    const views = [
      { id: 'a', settings: { spaceIds: ['1', '2'] }, name: 'Has it' },
      { id: 'b', settings: { spaceIds: ['3'] }, name: 'Does not' }
    ]
    expect(collectionsWithoutSpace(views, 2).map(v => v.id)).toEqual(['b'])
    expect(collectionsWithoutSpace(views, '9')).toHaveLength(2)
  })

  it('reorders visible space ids without dropping hidden ones', () => {
    expect(reorderVisibleSpaceIds(['hidden', 'a', 'b'], ['a', 'b'], 1, 0)).toEqual(['hidden', 'b', 'a'])
    expect(reorderVisibleSpaceIds(['a', 'hidden', 'b'], ['a', 'b'], 0, 1)).toEqual(['b', 'hidden', 'a'])
    expect(reorderVisibleSpaceIds(['a', 'b'], ['a', 'b'], 0, 1)).toEqual(['b', 'a'])
  })
})
