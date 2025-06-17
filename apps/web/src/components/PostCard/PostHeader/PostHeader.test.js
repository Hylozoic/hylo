import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import PostHeader, { TopicsLine } from './PostHeader'
import { RESP_ADMINISTRATION } from 'store/constants'

jest.mock('luxon', () => ({
  __esModule: true,
  default: () => ({
    fromNow: () => 'a few seconds ago',
    format: () => '2024-07-23 16:30'
  })
}))

const defaultProps = {
  post: {
    id: 1,
    createdTimestamp: 'a few seconds ago',
    exactCreatedTimestamp: '2024-07-23 16:30',
    group: { id: 1, name: 'FooC', slug: 'fooc' },
    creator: {
      name: 'JJ',
      avatarUrl: 'foo.png',
      id: 123,
      moderatedGroupMemberships: []
    },
    type: 'discussion',
    roles: [{
      id: 1,
      name: 'Coordinator',
      common: true,
      emoji: '👑',
      responsibilities: [{ id: 1, name: 'Administration' }]
    }]
  }
}

describe('PostHeader', () => {
  it('renders basic post header', () => {
    render(
      <PostHeader
        {...defaultProps}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
    expect(screen.getByText('a few seconds ago')).toBeInTheDocument()
  })

  it('renders post header with type', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={{
          ...defaultProps.post,
          type: 'request'
        }}
      />
    )

    expect(screen.getByText('JJ')).toBeInTheDocument()
  })

  it('renders post header with action buttons', () => {
    render(
      <PostHeader
        {...defaultProps}
        deletePost={() => {}}
        editPost={() => {}}
        duplicatePost={() => {}}
      />
    )

    expect(screen.getByTestId('post-header-more-icon')).toBeInTheDocument()
  })

  it('renders flagged post with moderation link', () => {
    render(
      <PostHeader
        {...defaultProps}
        isFlagged={true}
        moderationActionsGroupUrl='/moderation'
      />
    )

    // Find the link that contains the flag icon by its tooltip content
    const links = screen.getAllByRole('link')
    const flagLink = links.find(link => link.getAttribute('data-tooltip-content') === 'See why this post was flagged')
    expect(flagLink).toBeInTheDocument()
    expect(flagLink).toHaveAttribute('href', '/moderation')
    expect(flagLink.querySelector('.text-accent')).toBeInTheDocument()
  })

  it('renders pinned post with pin icon', () => {
    render(
      <PostHeader
        {...defaultProps}
        pinned={true}
      />
    )

    const pinIcon = screen.getByText('', { selector: '[data-tooltip-content="pinned post"]' })
    expect(pinIcon).toBeInTheDocument()
  })

  it('renders close button when close prop is provided', () => {
    const mockClose = jest.fn()
    render(
      <PostHeader
        {...defaultProps}
        close={mockClose}
      />
    )

    fireEvent.click(screen.getByTestId('close'))
    expect(mockClose).toHaveBeenCalled()
  })

  it('shows dropdown with all available actions', () => {
    const mockFunctions = {
      pinPost: jest.fn(),
      editPost: jest.fn(),
      duplicatePost: jest.fn(),
      deletePost: jest.fn(),
      canFlag: true
    }

    render(
      <PostHeader
        {...defaultProps}
        {...mockFunctions}
      />
    )

    const moreIcon = screen.getByTestId('post-header-more-icon')
    expect(moreIcon).toBeInTheDocument()
    fireEvent.click(moreIcon)

    // Check for dropdown menu items
    expect(screen.getByText('Pin')).toBeInTheDocument()
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Copy Link')).toBeInTheDocument()
    expect(screen.getByText('Flag')).toBeInTheDocument()
    expect(screen.getByText('Duplicate')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('handles flag action when canFlag is true', () => {
    const { container } = render(
      <PostHeader
        {...defaultProps}
        canFlag={true}
      />
    )

    // Open the dropdown menu
    fireEvent.click(screen.getByTestId('post-header-more-icon'))
    expect(screen.getByText('Flag')).toBeInTheDocument()
  })
})

describe('PostHeader with announcement', () => {
  it('renders announcement icon', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={{
          ...defaultProps.post,
          announcement: true
        }}
      />
    )

    expect(screen.getByTestId('post-header-announcement-icon')).toBeInTheDocument()
  })
})

describe('PostHeader with date range', () => {
  it('renders human readable dates', () => {
    render(
      <PostHeader
        {...defaultProps}
        post={{
          ...defaultProps.post,
          type: 'request',
          startTime: new Date('2028-11-29'),
          endTime: new Date('2034-11-29')
        }}
      />
    )

    expect(screen.getByText(/Starts:/)).toBeInTheDocument()
    expect(screen.getByText(/Ends:/)).toBeInTheDocument()
  })
})

describe('TopicsLine', () => {
  it('renders topics', () => {
    render(
      <TopicsLine
        topics={[{ name: 'one' }, { name: 'two' }]}
        slug='hay'
        newLine
      />
    )

    expect(screen.getByText('#one')).toBeInTheDocument()
    expect(screen.getByText('#two')).toBeInTheDocument()
  })
})
