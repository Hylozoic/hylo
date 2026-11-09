import { getReorderParams, wouldMakeInvalidHome } from './useViewReorder'

describe('wouldMakeInvalidHome', () => {
  const text = { id: '1', type: 'text' }
  const chat = { id: '2', type: 'chat' }
  const link = { id: '3', type: 'link' }
  const members = { id: '4', type: 'members' }

  it('allows reordering below a legacy invalid home', () => {
    expect(wouldMakeInvalidHome([text, members, chat], [text, chat, members])).toBe(false)
  })

  it('allows dragging an invalid home down so a real view becomes first', () => {
    expect(wouldMakeInvalidHome([chat, text, members], [text, chat, members])).toBe(false)
  })

  it('rejects dropping a non-home type onto the home slot', () => {
    expect(wouldMakeInvalidHome([link, chat, members], [chat, link, members])).toBe(true)
    expect(wouldMakeInvalidHome([text, chat], [chat, text])).toBe(true)
  })

  it('allows dropping a navigable view onto the home slot', () => {
    expect(wouldMakeInvalidHome([members, text, chat], [text, chat, members])).toBe(false)
  })
})

describe('getReorderParams', () => {
  const views = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]

  it('uses setHomeView when the drop lands at index 0', () => {
    expect(getReorderParams(views, 0)).toEqual({ type: 'home' })
  })

  it('appends when the drop lands at the end', () => {
    expect(getReorderParams(views, 2)).toEqual({ addToEnd: true })
  })

  it('inserts in front of the following view otherwise', () => {
    expect(getReorderParams(views, 1)).toEqual({ orderInFrontOfViewId: 'c' })
  })
})
