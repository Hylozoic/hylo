import getGroup from './getGroup'
import orm from '../models'

describe('getGroup', () => {
  let state

  beforeEach(() => {
    const session = orm.mutableSession(orm.getEmptyState())
    session.Group.create({ id: '1111', slug: 'slugger1' })
    session.Group.create({ id: '55', slug: 'myslug' })
    session.Group.create({ id: '3333', slug: 'slugger3' })
    state = { orm: session.state }
  })

  it('gets by id correctly', () => {
    const group = getGroup(state, { id: 55, slug: null })
    expect(group).toBeTruthy()
    expect(group.id).toBe('55')
  })

  it('gets by slug correctly', () => {
    const group = getGroup(state, { slug: 'myslug', id: null })
    expect(group).toBeTruthy()
    expect(group.id).toBe('55')
    expect(group.slug).toBe('myslug')
  })

  it('gets correctly if both id and slug defined', () => {
    const group = getGroup(state, { id: 55, slug: 'myslug' })
    expect(group).toBeTruthy()
    expect(group.id).toBe('55')
    expect(group.slug).toBe('myslug')
  })

  it('proves that ref is better than sessionBoundModel for performance in selectors', () => {
    const groupBySlug = getGroup(state, { slug: 'myslug' })
    getGroup(state, { id: 1111 }) // Forces a recompute since the selector has a cache size of 1
    const groupById = getGroup(state, { id: 55 })

    // Here we prove that even though it's the SAME group, it's using a sessionBoundModel object which doesn't have === equality,
    // hence, any purecomponent we pass it to will re-render every time it's recomputed.
    expect(groupBySlug === groupById).toBeFalsy()

    // If we get the `ref` than it is truthy, and even though the selector recomputed, it was still the same.
    expect(groupById.ref === groupBySlug.ref).toBeTruthy()
  })
})
