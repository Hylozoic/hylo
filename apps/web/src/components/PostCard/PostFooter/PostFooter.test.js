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
      />
    )

    expect(screen.getByText('Joe, Scary and 2 others commentedPlural')).toBeInTheDocument()
    // expect(screen.getByText('Scary Terry')).toBeInTheDocument()
    // expect(screen.getByText('John Larkin')).toBeInTheDocument()
    // expect(screen.queryByText('Sue Jones')).not.toBeInTheDocument() // Current user should be excluded
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
      />
    )

    // Since there are no commenters or specific content for events,
    // we'll check if the footer element is present
    expect(screen.getByTestId('post-footer')).toBeInTheDocument()
  })
})
