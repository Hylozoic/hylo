import React from 'react'
import { render, screen, fireEvent, waitFor, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Search from './Search'
import { FETCH_SEARCH } from './Search.store'
import orm from 'store/models'
import { ViewHeaderContext } from 'contexts/ViewHeaderContext'
import { CENTER_COLUMN_ID } from 'util/scrolling'
import trackAnalyticsEvent from 'store/actions/trackAnalyticsEvent'

jest.mock('store/actions/trackAnalyticsEvent', () => jest.fn(() => ({ type: 'TRACK_ANALYTICS_EVENT' })))
// Mock debounce to execute immediately in tests
jest.mock('lodash/fp', () => {
  const original = jest.requireActual('lodash/fp')
  return {
    ...original,
    debounce: (wait, fn) => (...args) => fn(...args)
  }
})

jest.mock('./Search.store', () => {
  // Create a stable reference for the mock results and a cache for memoization
  const defaultMockResults = [
    {
      id: '1',
      type: 'Person',
      content: {
        id: 1,
        name: 'Test Person',
        avatarUrl: 'test.png',
        location: 'Test Location',
        skills: [{ name: 'crawling' }, { name: 'walking' }]
      }
    }
  ]

  let currentMockResults = defaultMockResults
  let currentMockGroups = []
  const selectorCache = new Map()
  const groupSelectorCache = new Map()

  // Create a selector that implements memoization
  const getSearchResults = jest.fn((state, props = {}) => {
    const cacheKey = JSON.stringify(props)
    if (!selectorCache.has(cacheKey)) {
      selectorCache.set(cacheKey, currentMockResults)
    }
    return selectorCache.get(cacheKey)
  })

  const getSearchGroups = jest.fn((state, props = {}) => {
    const cacheKey = JSON.stringify(props)
    if (!groupSelectorCache.has(cacheKey)) {
      groupSelectorCache.set(cacheKey, currentMockGroups)
    }
    return groupSelectorCache.get(cacheKey)
  })

  return {
    getSearchResults,
    getSearchGroups,
    getSearchGroupsTotal: jest.fn(() => currentMockGroups.length),
    getHasMoreSearchGroups: jest.fn(() => false),
    getHasFetchedSearchGroups: jest.fn(() => true),
    fetchSearchResults: jest.fn(() => ({ type: 'FETCH_SEARCH_MOCK' })),
    fetchSearchGroups: jest.fn(() => ({ type: 'FETCH_SEARCH_GROUPS_MOCK' })),
    FETCH_SEARCH: 'FETCH_SEARCH',
    FETCH_SEARCH_GROUPS: 'FETCH_SEARCH_GROUPS',
    getHasMoreSearchResults: jest.fn(() => false),
    getHasFetchedSearchResults: jest.fn(() => true),
    getSearchError: jest.fn(() => null),
    getSearchGroupsError: jest.fn(() => null),
    formatSearchErrorMessage: jest.fn(() => null),
    // Expose a way to update mock results that maintains the cache
    __setMockResults: (newResults) => {
      currentMockResults = newResults
      selectorCache.clear() // Clear cache when results change
    },
    __setMockGroups: (newGroups) => {
      currentMockGroups = newGroups
      groupSelectorCache.clear()
    }
  }
})

// Get references to the mocked functions and utilities
const {
  getSearchResults: mockGetSearchResults,
  fetchSearchResults: mockFetchSearchResults,
  fetchSearchGroups: mockFetchSearchGroups,
  getHasMoreSearchResults: mockGetHasMoreSearchResults,
  getHasFetchedSearchGroups: mockGetHasFetchedSearchGroups,
  getSearchGroupsError: mockGetSearchGroupsError,
  formatSearchErrorMessage: mockFormatSearchErrorMessage,
  __setMockResults,
  __setMockGroups
} = jest.requireMock('./Search.store')

// Reset mocks before each test
beforeEach(() => {
  const centerColumn = document.createElement('div')
  centerColumn.id = CENTER_COLUMN_ID
  document.body.appendChild(centerColumn)

  // Reset to default mock results
  __setMockResults([
    {
      id: '1',
      type: 'Person',
      content: {
        id: 1,
        name: 'Test Person',
        avatarUrl: 'test.png',
        location: 'Test Location',
        skills: [{ name: 'crawling' }, { name: 'walking' }]
      }
    }
  ])
  __setMockGroups([])
  mockGetSearchResults.mockClear()
  mockFetchSearchResults.mockClear()
  mockFetchSearchGroups.mockClear()
  mockGetHasMoreSearchResults.mockClear()
  mockGetHasFetchedSearchGroups.mockImplementation(() => true)
  mockGetSearchGroupsError.mockImplementation(() => null)
  mockFormatSearchErrorMessage.mockImplementation(() => null)
  trackAnalyticsEvent.mockClear()
})

afterEach(() => {
  const centerColumn = document.getElementById(CENTER_COLUMN_ID)
  if (centerColumn) centerColumn.remove()
  require('react-router-dom').useLocation.mockReturnValue({ pathname: '', search: '' })
})

// react-router-dom's useLocation is mocked for every test (config/jest/beforeTestEnvSetup.js)
function searchFor (term) {
  require('react-router-dom').useLocation.mockReturnValue({ pathname: '/search', search: `?t=${encodeURIComponent(term)}` })
}

function testProviders (mockResults = []) {
  const ormSession = orm.mutableSession(orm.getEmptyState())
  ormSession.Me.create({ id: '1' })

  // Add the mock search results to the initial state
  const reduxState = {
    orm: ormSession.state,
    queryResults: {
      [FETCH_SEARCH]: {
        ids: mockResults.map(r => r.id),
        hasMore: false,
        total: mockResults.length
      }
    },
    pending: {} // Add empty pending state to avoid undefined errors
  }

  const viewHeaderValue = {
    setHeaderDetails: jest.fn(),
    headerDetails: {}
  }

  const Providers = ({ children }) => {
    const AllProviders = AllTheProviders(reduxState)
    return (
      <ViewHeaderContext.Provider value={viewHeaderValue}>
        <AllProviders>{children}</AllProviders>
      </ViewHeaderContext.Provider>
    )
  }

  return Providers
}

describe('Search', () => {
  it('renders search input and tabs', () => {
    const defaultMockResults = [
      {
        id: '1',
        type: 'Person',
        content: {
          id: 1,
          name: 'Test Person',
          avatarUrl: 'test.png',
          location: 'Test Location',
          skills: [{ name: 'crawling' }, { name: 'walking' }]
        }
      }
    ]

    render(<Search />, { wrapper: testProviders(defaultMockResults) })

    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Posts')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getByText('Test Person')).toBeInTheDocument()
  })

  it('renders person details correctly in search results', () => {
    const mockResults = [{
      id: '77',
      type: 'Person',
      content: {
        id: 77,
        name: 'Joe Person',
        avatarUrl: 'me.png',
        location: 'home',
        skills: [{ name: 'crawling' }, { name: 'walking' }]
      }
    }]

    __setMockResults(mockResults)

    render(<Search />, { wrapper: testProviders(mockResults) })

    expect(screen.getByText('Joe Person')).toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('shows the skill the search matched on a person card', () => {
    const mockResults = [{
      id: '77',
      type: 'Person',
      content: {
        id: 77,
        name: 'Joe Person',
        avatarUrl: 'me.png',
        location: 'home',
        skills: [{ name: 'crawling' }, { name: 'trail-walking' }]
      }
    }]

    __setMockResults(mockResults)
    searchFor('walk')
    render(<Search />, { wrapper: testProviders(mockResults) })

    expect(screen.getByText('trail-walking')).toBeInTheDocument()
    expect(screen.queryByText('crawling')).not.toBeInTheDocument()
  })

  it('shows no skill when the search matched something else', () => {
    const mockResults = [{
      id: '77',
      type: 'Person',
      content: { id: 77, name: 'Joe Person', avatarUrl: 'me.png', location: 'home', skills: [{ name: 'crawling' }] }
    }]

    __setMockResults(mockResults)
    searchFor('joe')
    render(<Search />, { wrapper: testProviders(mockResults) })

    expect(screen.getByText('Joe Person')).toBeInTheDocument()
    expect(screen.queryByText('crawling')).not.toBeInTheDocument()
  })

  it('does not fetch search results until the term is at least two characters', () => {
    render(<Search />, { wrapper: testProviders([]) })

    expect(mockFetchSearchResults).not.toHaveBeenCalled()
  })

  it('navigates to person profile when clicked', () => {
    const mockResults = [{
      id: '77',
      type: 'Person',
      content: {
        id: 77,
        name: 'Joe Person',
        avatarUrl: 'me.png',
        location: 'home',
        skills: [{ name: 'crawling' }, { name: 'walking' }]
      }
    }]

    __setMockResults(mockResults)

    const mockPush = jest.fn()
    jest.mock('redux-first-history', () => ({
      push: () => mockPush
    }))

    render(<Search />, { wrapper: testProviders(mockResults) })

    fireEvent.click(screen.getByText('Joe Person'))
    // This test needs a proper assertion for navigation
    // You might need to mock the push function and verify it was called
  })

  it('shows matching groups first on the All tab', async () => {
    __setMockResults([{
      id: '77',
      type: 'Person',
      content: { id: 77, name: 'Joe Person', avatarUrl: 'me.png', location: 'home', skills: [] }
    }])
    __setMockGroups([{ id: '5', name: 'Garden Circle', slug: 'garden-circle', memberCount: 12, description: 'We grow things' }])

    searchFor('garden')
    render(<Search />, { wrapper: testProviders() })

    const group = screen.getByText('Garden Circle')
    const person = screen.getByText('Joe Person')
    expect(group.compareDocumentPosition(person) & window.Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.getByText('Groups', { selector: 'h3' })).toBeInTheDocument()
    expect(group.closest('a')).toHaveAttribute('href', '/groups/garden-circle/about')
    // Fetches are debounced
    await waitFor(() => expect(mockFetchSearchGroups).toHaveBeenCalledWith({ search: 'garden' }), { timeout: 5000 })
  }, 30000)

  it('has a Groups tab that shows only groups', () => {
    __setMockResults([{
      id: '77',
      type: 'Person',
      content: { id: 77, name: 'Joe Person', avatarUrl: 'me.png', location: 'home', skills: [] }
    }])
    __setMockGroups([{ id: '5', name: 'Garden Circle', slug: 'garden-circle', memberCount: 12 }])

    searchFor('garden')
    render(<Search />, { wrapper: testProviders() })
    fireEvent.click(screen.getByText('Groups', { selector: 'span' }))

    expect(screen.getByText('Garden Circle')).toBeInTheDocument()
    expect(screen.queryByText('Joe Person')).not.toBeInTheDocument()
  })

  it('links the empty state to the Group Explorer with the search term', () => {
    __setMockResults([])
    __setMockGroups([])

    searchFor('garden club')
    render(<Search />, { wrapper: testProviders() })

    expect(screen.getByText('No results for this search')).toBeInTheDocument()
    expect(screen.getByTestId('search-explorer-link')).toHaveAttribute('href', '/public/groups?search=garden%20club')
  })

  it('records a finished search without the search term', () => {
    __setMockResults([{
      id: '77',
      type: 'Person',
      content: { id: 77, name: 'Joe Person', avatarUrl: 'me.png', location: 'home', skills: [] }
    }])
    __setMockGroups([{ id: '5', name: 'Garden Circle', slug: 'garden-circle', memberCount: 12 }])
    searchFor('garden club')

    render(<Search />, { wrapper: testProviders() })

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Search Performed', {
      tab: 'all',
      termLength: 11,
      resultCount: 2,
      zeroResults: false,
      scope: 'all'
    })
    const searchEvents = trackAnalyticsEvent.mock.calls.filter(([name]) => name === 'Search Performed')
    expect(searchEvents).toHaveLength(1)
    expect(JSON.stringify(searchEvents)).not.toContain('garden')
  })

  it('records an empty search as zero results', () => {
    __setMockResults([])
    __setMockGroups([])
    searchFor('zzz')

    render(<Search />, { wrapper: testProviders() })

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Search Performed', expect.objectContaining({ resultCount: 0, zeroResults: true }))
  })

  it('records which kind of result was opened', () => {
    __setMockResults([{
      id: '77',
      type: 'Person',
      content: { id: 77, name: 'Joe Person', avatarUrl: 'me.png', location: 'home', skills: [] }
    }])
    __setMockGroups([{ id: '5', name: 'Garden Circle', slug: 'garden-circle', memberCount: 12 }])
    searchFor('garden')

    render(<Search />, { wrapper: testProviders() })
    fireEvent.click(screen.getByText('Joe Person'))
    fireEvent.click(screen.getByText('Garden Circle'))

    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Search Result Clicked', { type: 'Person', tab: 'all' })
    expect(trackAnalyticsEvent).toHaveBeenCalledWith('Search Result Clicked', { type: 'Group', tab: 'all' })
  })

  it('still shows the other results and the empty state when the group search fails', () => {
    mockGetHasFetchedSearchGroups.mockImplementation(() => false)
    mockGetSearchGroupsError.mockImplementation(() => ({ message: 'Server error' }))
    __setMockResults([])
    searchFor('garden')

    render(<Search />, { wrapper: testProviders() })

    expect(screen.getByText('No results for this search')).toBeInTheDocument()
    expect(screen.getByTestId('search-explorer-link')).toBeInTheDocument()
    // A partial result is not recorded as a finished search
    expect(trackAnalyticsEvent).not.toHaveBeenCalledWith('Search Performed', expect.anything())
  })

  it('shows an error on the Groups tab when the group search fails', () => {
    mockGetHasFetchedSearchGroups.mockImplementation(() => false)
    mockGetSearchGroupsError.mockImplementation(() => ({ message: 'Server error' }))
    mockFormatSearchErrorMessage.mockImplementation(error => error ? 'Group search failed' : null)
    searchFor('garden')

    render(<Search />, { wrapper: testProviders() })
    fireEvent.click(screen.getByText('Groups', { selector: 'span' }))

    expect(screen.getByText('Group search failed')).toBeInTheDocument()
    expect(screen.queryByText('No results for this search')).not.toBeInTheDocument()
  })
})
