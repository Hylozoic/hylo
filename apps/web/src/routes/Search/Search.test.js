import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Search from './Search'
import { FETCH_SEARCH, getSearchResults } from './Search.store'
import orm from 'store/models'
import { ViewHeaderContext } from 'contexts/ViewHeaderContext'

jest.mock('lodash/debounce', () => fn => {
  fn.cancel = jest.fn()
  return fn
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
  const selectorCache = new Map()

  // Create a selector that implements memoization
  const getSearchResults = jest.fn((state, props = {}) => {
    const cacheKey = JSON.stringify(props)
    if (!selectorCache.has(cacheKey)) {
      selectorCache.set(cacheKey, currentMockResults)
    }
    return selectorCache.get(cacheKey)
  })

  return {
    getSearchResults,
    fetchSearchResults: jest.fn(),
    FETCH_SEARCH: 'FETCH_SEARCH',
    getHasMoreSearchResults: jest.fn(() => false),
    // Expose a way to update mock results that maintains the cache
    __setMockResults: (newResults) => {
      currentMockResults = newResults
      selectorCache.clear() // Clear cache when results change
    }
  }
})

// Get references to the mocked functions and utilities
const { 
  getSearchResults: mockGetSearchResults, 
  fetchSearchResults: mockFetchSearchResults, 
  getHasMoreSearchResults: mockGetHasMoreSearchResults,
  __setMockResults
} = jest.requireMock('./Search.store')

// Reset mocks before each test
beforeEach(() => {
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
  mockGetSearchResults.mockClear()
  mockFetchSearchResults.mockClear()
  mockGetHasMoreSearchResults.mockClear()
})

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
    }
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

describe.skip('Search', () => {
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

    expect(screen.getByLabelText('Search by keyword for people, posts and groups')).toBeInTheDocument()
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
    
    render(<Search />, { wrapper: testProviders(mockResults) })

    expect(screen.getByText('Joe Person')).toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('renders a skill when the search terms match a skill', () => {
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

    render(<Search searchForInput="walking" />, { wrapper: testProviders(mockResults) })

    expect(screen.getByText('walking')).toBeInTheDocument()
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

    render(<Search />, { wrapper: testProviders(mockResults) })

    fireEvent.click(screen.getByText('Joe Person'))
    // Add appropriate assertion for navigation
  })
})
