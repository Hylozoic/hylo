import orm from 'store/models'
import normalized from '../MemberProfile.normalized.test.json'
import { fetchRecentActivity, getRecentActivity } from './RecentActivity.store'

describe('fetchRecentActivity', () => {
  it('returns the correct action', () => {
    const actual = fetchRecentActivity('12345', 10, 0)
    expect(actual.type).toEqual('FETCH_RECENT_ACTIVITY')
    expect(actual.graphql.variables).toEqual({
      id: '12345',
      first: 10,
      offset: 0,
      order: 'desc'
    })
    expect(actual.meta).toEqual({ extractModel: 'Person' })
    expect(actual.graphql.query).toContain('query RecentActivity')
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
