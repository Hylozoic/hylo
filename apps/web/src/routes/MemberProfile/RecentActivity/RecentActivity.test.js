import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import RecentActivity from './RecentActivity'
import denormalized from '../MemberProfile.test.json'

describe('RecentActivity', () => {
  const { person } = denormalized.data

  it('renders activity items correctly', () => {
    render(
      <RecentActivity
        fetchRecentActivity={jest.fn()}
        routeParams={{}}
        activityItems={person.comments.concat(person.posts)}
      />
    )

    // Check if at least one activity item is rendered
    expect(screen.getByTestId('activity-item')).toBeInTheDocument()

    // Check if both PostCard and CommentCard components are rendered
    expect(screen.getByTestId('post-card')).toBeInTheDocument()
    expect(screen.getByTestId('comment-card')).toBeInTheDocument()
  })
})
