import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import * as LayoutFlagsContext from 'contexts/LayoutFlagsContext'
import MapDrawer, { TabBar } from './MapDrawer'

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
    expect(screen.getByText('Posts')).toBeInTheDocument()
    expect(screen.getByText('Groups')).toBeInTheDocument()
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
    expect(screen.getByText('Post')).toBeInTheDocument()
    expect(screen.getByText('group one')).toBeInTheDocument()
    expect(screen.getByText('#food')).toBeInTheDocument()
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

describe('TabBar', () => {
  it('renders tabs and handles tab selection', () => {
    const tabs = { Posts: 1, Groups: 2 }
    const selectTab = jest.fn()
    render(<TabBar currentTab='Posts' selectTab={selectTab} tabs={tabs} />)

    expect(screen.getByText('Posts')).toHaveClass('tabActive')
    expect(screen.getByText('Groups')).not.toHaveClass('tabActive')

    fireEvent.click(screen.getByText('Groups'))
    expect(selectTab).toHaveBeenCalledWith('Groups')
  })
})
