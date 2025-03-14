import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Search, { PersonCard } from './Search'
import { getSearchResults } from './Search.store'

const mockSearchResults = [
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

// mock getSearchResults
jest.mock('./Search.store', () => ({
  getSearchResults: jest.fn(() => mockSearchResults),
  fetchSearchResults: jest.fn(),
  FETCH_SEARCH: 'FETCH_SEARCH',
  getHasMoreSearchResults: jest.fn(() => false)
}))

describe('Search', () => {
  it('renders search input and tabs', () => {
    const props = {
    }

    render(<Search {...props} />)

    expect(screen.getByPlaceholderText('Search by keyword for people, posts and groups')).toBeInTheDocument()
    expect(screen.getByText('All')).toBeInTheDocument()
    expect(screen.getByText('Discussions')).toBeInTheDocument()
    expect(screen.getByText('People')).toBeInTheDocument()
    expect(screen.getByText('Comments')).toBeInTheDocument()
    expect(screen.getByText('Test Person')).toBeInTheDocument()
  })
})

describe('PersonCard', () => {
  const props = {
    person: {
      id: 77,
      name: 'Joe Person',
      avatarUrl: 'me.png',
      location: 'home',
      skills: [{ name: 'crawling' }, { name: 'walking' }]
    },
    highlightProps: {
      terms: ['cat']
    },
    showPerson: jest.fn()
  }

  it('renders person details correctly', () => {
    render(<PersonCard {...props} />)

    expect(screen.getByText('Joe Person')).toBeInTheDocument()
    expect(screen.getByText('home')).toBeInTheDocument()
  })

  it('renders a skill when the search terms match a skill', () => {
    const highlightProps = {
      terms: ['walking']
    }
    render(<PersonCard {...{ ...props, highlightProps }} />)

    expect(screen.getByText('walking')).toBeInTheDocument()
  })

  it('calls showPerson when clicked', () => {
    render(<PersonCard {...props} />)

    fireEvent.click(screen.getByText('Joe Person'))
    expect(props.showPerson).toHaveBeenCalledWith(77)
  })
})
