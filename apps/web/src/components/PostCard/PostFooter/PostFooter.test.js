import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PostFooter from './PostFooter'

const commenters = [
  { name: 'Joe Smith', id: '1', avatarUrl: '' },
  { name: 'Sue Jones', id: '2', avatarUrl: '' },
  { name: 'Scary Terry', id: '3', avatarUrl: '' },
  { name: 'John Larkin', id: '4', avatarUrl: '' }
]

describe('PostFooter', () => {
  it('renders commenters correctly', () => {
    render(
      <PostFooter
        commenters={commenters}
        commentersTotal={4}
        currentUser={commenters[1]}
        peopleReactedTotal={3}
        postReactions={[]}
        groups={[]}
      />
    )

    expect(screen.getByTestId('post-footer')).toBeInTheDocument()
    expect(screen.getByText(/Joe/)).toBeInTheDocument()
  })

  it('shows count-only comment label when logged out', () => {
    render(
      <PostFooter
        commenters={commenters}
        commentersTotal={4}
        currentUser={null}
        postReactions={[]}
        peopleReactedTotal={0}
        groups={[]}
      />
    )

    expect(screen.getByTestId('post-footer')).toBeInTheDocument()
    expect(screen.getByText('4 people commented')).toBeInTheDocument()
    expect(screen.queryByText(/Joe/)).not.toBeInTheDocument()
  })

  it('renders event footer correctly', () => {
    render(
      <PostFooter
        commenters={[]}
        commentersTotal={0}
        currentUser={null}
        postReactions={[]}
        peopleReactedTotal={0}
        type='event'
        groups={[]}
      />
    )

    expect(screen.getByTestId('post-footer')).toBeInTheDocument()
    expect(screen.getByText('Be the first to comment')).toBeInTheDocument()
  })
})
