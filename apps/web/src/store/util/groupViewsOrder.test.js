import { mergeReorderedWithHidden } from './groupViewsOrder'

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
