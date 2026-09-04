import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import * as LayoutFlagsContext from 'contexts/LayoutFlagsContext'
import MapDrawer from './MapDrawer'

const defaultMinProps = {
  context: 'groups',
  currentUser: { id: 1 },
  fetchPostsForDrawer: jest.fn(),
  filters: { search: '', sortBy: 'updated', topics: [] },
  groups: [],
  members: [],
  numFetchedPosts: 0,
  numTotalPosts: 0,
  onUpdateFilters: jest.fn(),
  pendingPostsDrawer: false,
  posts: [],
  routeParams: { context: 'groups', slug: 'group one' },
  topics: []
}

describe('MapDrawer', () => {
  beforeAll(() => {
    jest.spyOn(LayoutFlagsContext, 'useLayoutFlags').mockImplementation(() => ({}))
  })

  it('renders correctly with minimum props', () => {
    render(<MapDrawer {...defaultMinProps} />)
    expect(screen.getByPlaceholderText('Filter by topics and keywords')).toBeInTheDocument()
    // The result-type tabs live in one lens dropdown now, defaulting to All
    expect(screen.getByTestId('map-lens-dropdown')).toHaveTextContent('All')
    expect(screen.getByTestId('map-drawer-close')).toBeInTheDocument()
  })

  it('renders correctly with lots of content', () => {
    const props = {
      ...defaultMinProps,
      groups: [
        { id: 1, slug: 'slug2', name: 'group one', avatarUrl: 'https://google.com', description: 'yo', memberCount: 1 }
      ],
      members: [
        { id: 2, name: 'hello' }
      ],
      posts: [
        { id: 1, title: 'Post', type: 'request', groups: [{ id: 1, name: 'group one', slug: 'slug2' }] }
      ],
      filters: { sortBy: 'created', search: 'hello', topics: [{ id: 1, name: 'food' }] }
    }
    render(<MapDrawer {...props} />)
    // The default All lens shows posts, groups and people together
    expect(screen.getByText('Post')).toBeInTheDocument()
    expect(screen.getByText('#food')).toBeInTheDocument()
    expect(screen.getByText('group one')).toBeInTheDocument()
    expect(screen.getByText('hello')).toBeInTheDocument()
  })

  it('updates filters when searching', () => {
    const onUpdateFilters = jest.fn()
    render(<MapDrawer {...defaultMinProps} onUpdateFilters={onUpdateFilters} topics={[{ id: 3, name: 'DOAs' }]} />)

    const searchBox = screen.getByPlaceholderText('Filter by topics and keywords')
    fireEvent.focus(searchBox)
    fireEvent.change(searchBox, { target: { value: 'search' } })
    fireEvent.keyUp(searchBox, { key: 'Enter', code: 'Enter', keyCode: 13 })

    expect(onUpdateFilters).toHaveBeenCalledWith({ search: 'search' })
  })
})
