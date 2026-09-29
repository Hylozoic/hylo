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
  })

  it('shows Share for a post or event', () => {
    render(
      <PostFooter
        commenters={[]}
        commentersTotal={0}
        currentUser={null}
        postReactions={[]}
        peopleReactedTotal={0}
        type='event'
        postId='12'
        groups={[]}
      />
    )
    expect(screen.getByTestId('post-share-button')).toBeInTheDocument()
  })

  it('leaves Share off chat messages and posts that are still being sent', () => {
    const { unmount } = render(
      <PostFooter commenters={[]} commentersTotal={0} postReactions={[]} peopleReactedTotal={0} type='chat' postId='13' groups={[]} />
    )
    expect(screen.queryByTestId('post-share-button')).not.toBeInTheDocument()
    unmount()

    render(
      <PostFooter commenters={[]} commentersTotal={0} postReactions={[]} peopleReactedTotal={0} type='discussion' postId='post_3' groups={[]} />
    )
    expect(screen.queryByTestId('post-share-button')).not.toBeInTheDocument()
  })
})
