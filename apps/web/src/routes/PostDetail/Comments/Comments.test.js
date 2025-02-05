import React from 'react'
import { render, screen, AllTheProviders } from 'util/testing/reactTestingLibraryExtended'
import Comments from './Comments'
import ShowMore from './ShowMore'

describe('Comments', () => {
  it('renders correctly', () => {
    const props = {
      currentUser: { id: 1 },
      comments: [
        { id: 1, parentComment: null, text: 'Comment 1', childComments: [], creator: { id: 1, name: 'Joe Smith', avatarUrl: 'foo.jpg' } },
        { id: 2, parentComment: null, text: 'Comment 2', childComments: [], creator: { id: 2, name: 'Jane Doe', avatarUrl: 'bar.jpg' } },
        { id: 3, parentComment: null, text: 'Comment 3', childComments: [], creator: { id: 3, name: 'John Doe', avatarUrl: 'baz.jpg' } }
      ],
      total: 9,
      hasMore: true,
      post: {
        id: '91',
        groups: [{ id: '100' }]
      },
      slug: 'foo',
      createComment: jest.fn()
    }

    render(<Comments {...props} />)

    expect(screen.getByText('View 6 previous comments')).toBeInTheDocument()
    expect(screen.getByText('Comment 1')).toBeInTheDocument()
    expect(screen.getByText('Comment 2')).toBeInTheDocument()
    expect(screen.getByText('Comment 3')).toBeInTheDocument()
    // expect(screen.getByPlaceholderText('Write a comment...')).toBeInTheDocument()
  })

  it('renders login link when user is not logged in', () => {
    const props = {
      comments: [],
      total: 0,
      hasMore: false,
      post: { id: '91', groups: [{ id: '100' }] },
      slug: 'foo'
    }

    render(<Comments {...props} />)

    expect(screen.getByText('Join Hylo to respond')).toBeInTheDocument()
  })
})

describe('ShowMore', () => {
  it('does not render when hasMore is false', () => {
    const props = {
      hasMore: false,
      commentsLength: 4,
      total: 4
    }

    render(<ShowMore {...props} />)

    expect(screen.queryByText(/View .* previous comments/)).not.toBeInTheDocument()
  })

  it('renders correctly when there are more comments to show', () => {
    const props = {
      commentsLength: 4,
      total: 11,
      hasMore: true
    }

    render(<ShowMore {...props} />)

    expect(screen.getByText('View 7 previous comments')).toBeInTheDocument()
  })
})
