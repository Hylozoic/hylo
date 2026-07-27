import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import Comments from './Comments'
import ShowMore from './ShowMore'

describe('Comments', () => {
  it('renders login link when user is not logged in', () => {
    const props = {
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
