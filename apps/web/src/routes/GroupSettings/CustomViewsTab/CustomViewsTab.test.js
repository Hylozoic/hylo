import React from 'react'
import { render, screen, fireEvent, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import CustomViewsTab from './CustomViewsTab'

describe('CustomViewsTab', () => {
  const mockGroup = {
    id: 1,
    name: 'Foomunity',
    slug: 'foo',
    locationObject: 'Fuji',
    description: 'Great group',
    avatarUrl: 'avatar.png',
    bannerUrl: 'avatar.png',
    customViews: [{
      activePostsOnly: false,
      externalLink: 'https://google.com',
      icon: 'Public',
      isActive: true,
      name: 'custommm baby',
      order: 1,
      postTypes: [],
      topics: [],
      type: 'externalLink'
    }]
  }

  const mockFetchCollectionPosts = jest.fn()

  it('renders correctly with initial state', () => {
    render(
      <AllTheProviders>
        <CustomViewsTab group={mockGroup} fetchCollectionPosts={mockFetchCollectionPosts} />
      </AllTheProviders>
    )

    expect(screen.getByText('Custom Views')).toBeInTheDocument()
    expect(screen.getByText('custommm baby')).toBeInTheDocument()
    expect(screen.getByText('Current settings up to date')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled()
  })

  it('enables save button when changes are made', () => {
    render(
      <AllTheProviders>
        <CustomViewsTab group={mockGroup} fetchCollectionPosts={mockFetchCollectionPosts} />
      </AllTheProviders>
    )

    const nameInput = screen.getByLabelText('Label')
    fireEvent.change(nameInput, { target: { value: 'New Custom View Name' } })

    expect(screen.getByText('Changes not saved')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeEnabled()
  })

  it('adds a new custom view when clicking the add button', () => {
    render(
      <AllTheProviders>
        <CustomViewsTab group={mockGroup} fetchCollectionPosts={mockFetchCollectionPosts} />
      </AllTheProviders>
    )

    const addButton = screen.getByText('Create new custom view')
    fireEvent.click(addButton)

    expect(screen.getAllByText(/Custom View #\d+/).length).toBe(2)
  })

  it('deletes a custom view when clicking the delete button', () => {
    window.confirm = jest.fn(() => true) // Mock the confirm dialog

    render(
      <AllTheProviders>
        <CustomViewsTab group={mockGroup} fetchCollectionPosts={mockFetchCollectionPosts} />
      </AllTheProviders>
    )

    const deleteButton = screen.getByRole('button', { name: 'Trash' })
    fireEvent.click(deleteButton)

    expect(screen.queryByText('custommm baby')).not.toBeInTheDocument()
  })
})
