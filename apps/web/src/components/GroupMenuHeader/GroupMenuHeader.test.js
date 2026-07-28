import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import GroupMenuHeader from './GroupMenuHeader'

const group = {
  bannerUrl: 'banner.png',
  avatarUrl: 'avatar.png',
  name: 'Spacebase',
  slug: 'spacebase',
  memberCount: 18
}

describe('GroupMenuHeader', () => {
  it('renders with a group', () => {
    render(
      <GroupMenuHeader
        group={group}
      />
    )
    expect(screen.getByText('Spacebase')).toBeInTheDocument()
    expect(screen.getByTestId('group-header')).toBeInTheDocument()
  })

  it('renders when images are not provided', () => {
    const groupWithoutImages = { ...group, avatarUrl: null, bannerUrl: null }
    render(
      <GroupMenuHeader
        group={groupWithoutImages}
      />
    )
    expect(screen.getByText('Spacebase')).toBeInTheDocument()
    expect(screen.getByTestId('group-header')).toBeInTheDocument()
  })
})
