import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import MemberComments from './MemberComments'

describe('MemberComments', () => {
  it('displays loading state when loading prop is true', () => {
    render(
      <MemberComments routeParams={{ personId: '1' }} loading />
    )

    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders empty list when there are no comments', () => {
    const { container } = render(
      <MemberComments routeParams={{ personId: '1' }} loading={false} />
    )

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="comment-card"]')).toHaveLength(0)
  })
})
