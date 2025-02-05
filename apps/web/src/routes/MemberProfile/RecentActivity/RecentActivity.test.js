import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import RecentActivity from './RecentActivity'
import denormalized from '../MemberProfile.test.json'

describe('RecentActivity', () => {
  const { person } = denormalized.data

  it('renders activity items correctly', () => {
    jest.spyOn(require('react-router-dom'), 'useParams').mockReturnValue({ context: 'groups', groupSlug: 'foom' })

    render(
      <RecentActivity
        fetchRecentActivity={jest.fn()}
        routeParams={{}}
        activityItems={person.comments.concat(person.posts)}
      />
    )

    expect(screen.queryAllByTestId('activity-item')).toHaveLength(4)

    // Check if both PostCard and CommentCard components are rendered
    expect(screen.queryAllByTestId('post-card')).toHaveLength(2)
    expect(screen.queryAllByTestId('comment-card')).toHaveLength(2)
  })
})
