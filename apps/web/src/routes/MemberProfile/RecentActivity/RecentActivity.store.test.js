import orm from 'store/models'
import normalized from '../MemberProfile.normalized.test.json'
import { fetchRecentActivity, getRecentActivity } from './RecentActivity.store'
import { mergeIds, pageHasMore } from '../profilePaging'

describe('fetchRecentActivity', () => {
  it('returns the correct action', () => {
    const actual = fetchRecentActivity('12345', 10, 0)
    expect(actual.type).toEqual('FETCH_RECENT_ACTIVITY')
    expect(actual.graphql.variables).toEqual({
      id: '12345',
      first: 10,
      postsOffset: 0,
      commentsOffset: 0,
      order: 'desc',
      sortBy: 'created'
    })
    expect(actual.meta).toEqual({ extractModel: 'Person' })
    expect(actual.graphql.query).toContain('query RecentActivity')
    expect(actual.graphql.query).toContain('comments (first: $first, offset: $commentsOffset, order: $order)')
    expect(actual.graphql.query).toContain('offset: $postsOffset')
    expect(actual.graphql.query).toContain('hasMore')
  })
})

describe('profile paging', () => {
  it('keeps paging when either collection has another page of new rows', () => {
    expect(pageHasMore({ hasMore: true, items: [{ id: 1 }] }, 1, 10)).toBe(true)
    expect(pageHasMore({ hasMore: false, items: [{ id: 1 }, { id: 2 }] }, 2, 2)).toBe(true)
  })

  it('stops when a page adds no new rows or both collections are exhausted', () => {
    expect(pageHasMore({ hasMore: true, items: [{ id: 1 }] }, 0, 10)).toBe(false)
    expect(pageHasMore({ hasMore: false, items: [{ id: 1 }] }, 1, 10)).toBe(false)
    expect(pageHasMore(undefined, 1, 10)).toBe(false)
  })

  it('appends only ids that were not already collected', () => {
    expect(mergeIds(['1'], [{ id: 1 }, { id: '2' }])).toEqual({ ids: ['1', '2'], added: 1 })
  })
})

describe('connector', () => {
  let session
  let state = null
  let props

  beforeEach(() => {
    session = orm.mutableSession(orm.getEmptyState())

    session.Person.create(normalized.person)
    session.Post.create(normalized.posts[1])
    session.Comment.create(normalized.comments[0])
    state = { orm: session.state }
    props = { routeParams: { personId: '46816', slug: 'wombats' } }
  })

  describe('getRecentActivity', () => {
    it('indexes activityItems preseving sort order', () => {
      const expected = [
        '2021-08-12T15:00:00.000Z',
        '2021-05-12T15:00:00.000Z'
      ]
      const actual = getRecentActivity(state, props)
        .map(item => item.createdAt)

      expect(actual).toEqual(expected)
    })

    it('selects Comments and Posts if both are present', () => {
      const allItems = getRecentActivity(state, props)
      const postItems = allItems.filter(item => item.title)
      expect(postItems.length).toBeLessThan(allItems.length)
    })
  })

  describe('activity selector length', () => {
    it('returns activity items of the correct length', () => {
      expect(getRecentActivity(state, props)).toHaveLength(2)
    })
  })
})
