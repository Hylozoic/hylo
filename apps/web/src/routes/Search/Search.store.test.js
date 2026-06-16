import searchReducer, {
  presentSearchResult,
  formatSearchErrorMessage,
  FETCH_SEARCH,
  getHasFetchedSearchResults
} from './Search.store'
import { buildKey } from 'store/reducers/queryResults'
import orm from 'store/models'

describe('presentSearchResult', () => {
  const session = orm.session(orm.getEmptyState())
  const commentId = 21
  const creator = session.Person.create({
    name: 'Ron'
  })
  session.Post.create({
    id: 'commentpost'
  })
  session.Comment.create({
    id: commentId,
    creator: creator.id,
    post: 'commentpost'
  })
  session.Attachment.create({
    url: 'foo.png',
    comment: commentId
  })
  const searchResult = session.SearchResult.create({
    content: `Comment-${commentId}`
  })

  it('presents a Comment SearchResult', () => {
    expect(presentSearchResult(searchResult, session))
      .toMatchSnapshot()
  })
})

describe('formatSearchErrorMessage', () => {
  const t = (key) => key

  it('returns a generic message for HTML error responses', () => {
    const error = {
      message: '<html><body>503 Service Unavailable</body></html>',
      response: { body: '<html><body>503 Service Unavailable</body></html>' }
    }
    expect(formatSearchErrorMessage(error, t))
      .toBe('Oh no, something went wrong! Check your internet connection and try again')
  })

  it('returns a GraphQL error message when available', () => {
    const error = { message: 'Search is not available' }
    expect(formatSearchErrorMessage(error, t)).toBe('Search is not available')
  })

  it('parses JSON error messages from the response body', () => {
    const error = {
      message: 'error',
      response: { body: '{"error":"Invalid search term"}' }
    }
    expect(formatSearchErrorMessage(error, t)).toBe('Invalid search term')
  })
})

describe('getHasFetchedSearchResults', () => {
  const props = { search: 'hylo', type: 'all', groupIds: null }
  const key = buildKey(FETCH_SEARCH, props)

  it('is false when there is no cached query result for the search', () => {
    expect(getHasFetchedSearchResults({ queryResults: {} }, props)).toBe(false)
  })

  it('is true after a search query has been cached', () => {
    expect(getHasFetchedSearchResults({
      queryResults: {
        [key]: { ids: [], total: 0, hasMore: false }
      }
    }, props)).toBe(true)
  })
})

describe('Search reducer', () => {
  const variables = { search: 'hylo', type: 'all', groupIds: null, offset: 0 }
  const key = buildKey(FETCH_SEARCH, variables)

  it('stores an error for a failed search', () => {
    const state = searchReducer({}, {
      type: FETCH_SEARCH,
      error: true,
      payload: { message: 'Server error' },
      meta: { graphql: { variables } }
    })
    expect(state[key]).toEqual({ message: 'Server error' })
  })

  it('clears an error when a new search is pending', () => {
    const state = searchReducer({ [key]: { message: 'Server error' } }, {
      type: FETCH_SEARCH + '_PENDING',
      meta: { graphql: { variables } }
    })
    expect(state[key]).toBeUndefined()
  })

  it('clears an error after a successful search', () => {
    const state = searchReducer({ [key]: { message: 'Server error' } }, {
      type: FETCH_SEARCH,
      meta: { graphql: { variables } },
      payload: { data: { search: { items: [] } } }
    })
    expect(state[key]).toBeUndefined()
  })
})
