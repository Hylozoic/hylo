import {
  mergeReorderedWithHidden,
  removeGroupViewFromMenu,
  setGroupViewHiddenInMenu,
  syncAcceptedPostTypesInMenus
} from './groupViewsOrder'

function makeGroup (groupViews) {
  let current = { items: groupViews }
  return {
    get groupViews () {
      return current
    },
    update ({ groupViews: next }) {
      current = next
    }
  }
}

describe('setGroupViewHiddenInMenu', () => {
  it('hides a nested space view on the parent menu copy', () => {
    const parent = makeGroup([
      {
        id: 'space-view',
        type: 'space',
        order: 0,
        linkedGroup: {
          id: 'space-1',
          groupViews: {
            items: [
              { id: 'v1', type: 'all', order: 0 },
              { id: 'v2', type: 'chat', order: 1 },
              { id: 'v3', type: 'members', order: 2 }
            ]
          }
        }
      }
    ])

    setGroupViewHiddenInMenu(parent, 'v2', true)

    const nested = parent.groupViews.items[0].linkedGroup.groupViews.items
    expect(nested.map(v => ({ id: v.id, order: v.order }))).toEqual([
      { id: 'v1', order: 0 },
      { id: 'v3', order: 1 },
      { id: 'v2', order: null }
    ])
  })
})

describe('removeGroupViewFromMenu', () => {
  it('removes a nested space view from the parent menu copy', () => {
    const parent = makeGroup([
      {
        id: 'space-view',
        type: 'space',
        order: 0,
        linkedGroup: {
          id: 'space-1',
          groupViews: {
            items: [
              { id: 'v1', type: 'all', order: 0 },
              { id: 'v2', type: 'chat', order: 1 }
            ]
          }
        }
      }
    ])

    removeGroupViewFromMenu(parent, 'v2')

    const nested = parent.groupViews.items[0].linkedGroup.groupViews.items
    expect(nested.map(v => v.id)).toEqual(['v1'])
  })
})

describe('syncAcceptedPostTypesInMenus', () => {
  it('updates the space Group and nested parent-menu linkedGroup copies', () => {
    let spaceAccepted = ['discussion']
    const space = {
      id: 'space-1',
      update ({ acceptedPostTypes }) { spaceAccepted = acceptedPostTypes }
    }

    let menuItems = [
      {
        id: 'space-view',
        type: 'space',
        order: 0,
        linkedGroup: {
          id: 'space-1',
          acceptedPostTypes: ['discussion'],
          groupViews: { items: [] }
        }
      }
    ]
    let spaces = { items: [{ id: 'space-1', acceptedPostTypes: ['discussion'] }] }
    const parent = {
      id: 'parent-1',
      get groupViews () { return { items: menuItems } },
      get spaces () { return spaces },
      update (attrs) {
        if (attrs.groupViews) menuItems = attrs.groupViews.items
        if (attrs.spaces) spaces = attrs.spaces
      }
    }

    syncAcceptedPostTypesInMenus([space, parent], 'space-1', ['discussion', 'event'])

    expect(spaceAccepted).toEqual(['discussion', 'event'])
    expect(menuItems[0].linkedGroup.acceptedPostTypes).toEqual(['discussion', 'event'])
    expect(spaces.items[0].acceptedPostTypes).toEqual(['discussion', 'event'])
  })
})

describe('mergeReorderedWithHidden', () => {
  it('keeps off-menu views when applying a reorder of in-menu items', () => {
    const existing = [
      { id: '1', type: 'all', order: 0 },
      { id: '2', type: 'chat', order: 1 },
      { id: '3', type: 'members', order: null },
      { id: '4', type: 'space', order: null, linkedGroup: { id: '9' } }
    ]
    const reordered = [
      { id: '2', type: 'chat', order: 1 },
      { id: '1', type: 'all', order: 0 }
    ]

    const merged = mergeReorderedWithHidden(existing, reordered)

    expect(merged.map(v => ({ id: v.id, order: v.order }))).toEqual([
      { id: '2', order: 0 },
      { id: '1', order: 1 },
      { id: '3', order: null },
      { id: '4', order: null }
    ])
  })

  it('does not duplicate a view that appears in both lists', () => {
    const existing = [
      { id: '1', type: 'all', order: 0 },
      { id: '2', type: 'chat', order: null }
    ]
    const reordered = [
      { id: '2', type: 'chat', order: 0 },
      { id: '1', type: 'all', order: 1 }
    ]

    const merged = mergeReorderedWithHidden(existing, reordered)

    expect(merged.map(v => v.id)).toEqual(['2', '1'])
    expect(merged.every(v => v.order != null)).toBe(true)
  })
})
