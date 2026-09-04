import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import MemberPosts from './MemberPosts'

describe('MemberPosts', () => {
  it('renders loading state when loading prop is true', () => {
    render(<MemberPosts routeParams={{ personId: '1' }} loading />)
    expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
  })

  it('renders empty list when there are no posts', () => {
    const { container } = render(
      <MemberPosts routeParams={{ personId: '1' }} loading={false} />
    )

    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument()
    expect(container.querySelectorAll('[data-testid="post-card"]')).toHaveLength(0)
  })
})
