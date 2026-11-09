import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Comments from './Comments'
import ShowMore from './ShowMore'

describe('Comments', () => {
  it('shows commenter count and login CTA when user is not logged in', () => {
    const props = {
      post: { id: '91', groups: [{ id: '100' }], commentersTotal: 3 },
      slug: 'foo'
    }

    render(<Comments {...props} />)

    expect(screen.getByTestId('comments-login-prompt')).toBeInTheDocument()
    expect(screen.getByText('3 people commented')).toBeInTheDocument()
    expect(screen.getByText('Log in to see comments')).toBeInTheDocument()
    expect(screen.queryByText('Join Hylo to respond')).not.toBeInTheDocument()
  })

  it('shows empty-state copy when there are no commenters and user is logged out', () => {
    const props = {
      post: { id: '91', groups: [{ id: '100' }], commentersTotal: 0 },
      slug: 'foo'
    }

    render(<Comments {...props} />)

    expect(screen.getByText('No comments yet')).toBeInTheDocument()
    expect(screen.getByText('Log in to see comments')).toBeInTheDocument()
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
