import { collectLinkedGroups, collectSpaceGroups } from './extractNestedGroups'

describe('collectLinkedGroups', () => {
  it('extracts linked groups without nested groupViews so unread is not overwritten', () => {
    const items = [{
      type: 'space',
      linkedGroup: {
        id: 'space-1',
        slug: 'parent-space',
        name: 'Garden',
        groupViews: {
          items: [
            { id: 'v1', type: 'chat', newPostCount: 0 },
            {
              type: 'space',
              linkedGroup: { id: 'nested-1', slug: 'parent-space-nested', name: 'Nested' }
            }
          ]
        }
      }
    }]

    const extracted = collectLinkedGroups(items)

    expect(extracted).toEqual([
      { id: 'space-1', slug: 'parent-space', name: 'Garden' },
      { id: 'nested-1', slug: 'parent-space-nested', name: 'Nested' }
    ])
    expect(items[0].linkedGroup.groupViews.items).toHaveLength(2)
  })
})

describe('collectSpaceGroups', () => {
  it('extracts spaces without groupViews or spaces lists', () => {
    const items = [{
      id: 'space-1',
      slug: 'parent-space',
      name: 'Garden',
      spaces: { items: [] },
      groupViews: {
        items: [{ id: 'v1', type: 'discussions', newPostCount: 2 }]
      }
    }]

    expect(collectSpaceGroups(items)).toEqual([
      { id: 'space-1', slug: 'parent-space', name: 'Garden' }
    ])
    expect(items[0].groupViews.items[0].newPostCount).toBe(2)
  })
})
