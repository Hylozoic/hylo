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
        myReactions={[]}
        postReactions={[]}
      />
    )

    expect(screen.getByText('Joe Smith')).toBeInTheDocument()
    expect(screen.getByText('Scary Terry')).toBeInTheDocument()
    expect(screen.getByText('John Larkin')).toBeInTheDocument()
    expect(screen.queryByText('Sue Jones')).not.toBeInTheDocument() // Current user should be excluded
  })

  it('renders project footer correctly', () => {
    const members = [{
      id: 1,
      name: 'Sarah Brown',
      avatarUrl: ''
    }]

    render(
      <PostFooter
        commenters={[]}
        commentersTotal={0}
        currentUser={commenters[1]}
        myReactions={[]}
        postReactions={[]}
        peopleReactedTotal={0}
        type='project'
        members={members}
      />
    )

    expect(screen.getByText('Sarah Brown')).toBeInTheDocument()
  })

  it('renders event footer correctly', () => {
    render(
      <PostFooter
        commenters={[]}
        commentersTotal={0}
        currentUser={null}
        myReactions={[]}
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
