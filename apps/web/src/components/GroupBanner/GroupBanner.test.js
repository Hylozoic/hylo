import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupBanner, { PostPrompt } from './GroupBanner'

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
      <BrowserRouter>
        <GroupBanner
          group={group}
          routeParams={{ view: 'stream', slug: 'foo' }}
          isTesting
        />
      </BrowserRouter>
    )
    expect(screen.getByText('Spacebase')).toBeInTheDocument()
    expect(screen.getByText('space, duh')).toBeInTheDocument()
  })

  it('renders for all groups', () => {
    render(
      <BrowserRouter>
        <GroupBanner
          context='all'
          routeParams={{ view: 'stream' }}
          currentUser={currentUser}
          currentUserHasMemberships
        />
      </BrowserRouter>
    )
    expect(screen.getByText('All My Groups')).toBeInTheDocument()
    expect(screen.getByText('18 Groups')).toBeInTheDocument()
  })

  it('renders for an orphan user', () => {
    render(
      <BrowserRouter>
        <GroupBanner
          context='all'
          routeParams={{ view: 'stream', slug: 'foo' }}
          currentUser={currentUser}
          currentUserHasMemberships={false}
        />
      </BrowserRouter>
    )
    expect(screen.getByText('All My Groups')).toBeInTheDocument()
    expect(screen.getByText('18 Groups')).toBeInTheDocument()
    expect(screen.queryByTestId('post-prompt')).not.toBeInTheDocument()
  })
})

describe('PostPrompt', () => {
  it('renders a post prompt', () => {
    render(
      <BrowserRouter>
        <PostPrompt firstName='Arturo' type='project' />
      </BrowserRouter>
    )
    expect(screen.getByText('Hi Arturo, what would you like to create?')).toBeInTheDocument()
  })
})
