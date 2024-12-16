import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupBanner from './GroupBanner'
import PostPrompt from './PostPrompt'

const currentUser = {
  avatarUrl: 'me.png',
  firstName: () => 'Bob',
  memberships: {
    count: () => 18
  }
}

const group = {
  bannerUrl: 'banner.png',
  avatarUrl: 'avatar.png',
  name: 'Spacebase',
  location: 'space, duh'
}

describe('GroupBanner', () => {
  it('renders with a group', () => {
    render(
      <GroupBanner
        group={group}
        routeParams={{ view: 'stream', slug: 'foo' }}
        isTesting
      />
    )
    expect(screen.getByText('Spacebase')).toBeInTheDocument()
    expect(screen.getByText('space, duh')).toBeInTheDocument()
  })

  it('renders for all groups', () => {
    render(
      <GroupBanner
        context='all'
        routeParams={{ view: 'stream' }}
        currentUser={currentUser}
        currentUserHasMemberships
      />
    )
    expect(screen.getByText('All My Groups')).toBeInTheDocument()
    expect(screen.getByText('18 Groups')).toBeInTheDocument()
  })

  it('renders for an orphan user', () => {
    render(
      <GroupBanner
        context='all'
        routeParams={{ view: 'stream', slug: 'foo' }}
        currentUser={currentUser}
        currentUserHasMemberships={false}
      />
    )
    expect(screen.getByText('All My Groups')).toBeInTheDocument()
    expect(screen.getByText('18 Groups')).toBeInTheDocument()
    expect(screen.queryByTestId('post-prompt')).not.toBeInTheDocument()
  })
})

describe('PostPrompt', () => {
  it('renders a post prompt', () => {
    render(
      <PostPrompt firstName='Arturo' type='project' />
    )
    expect(screen.getByText('Hi Arturo, what would you like to create?')).toBeInTheDocument()
  })
})
