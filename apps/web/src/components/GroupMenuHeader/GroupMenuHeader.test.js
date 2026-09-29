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

  // The member welcome tour's invite step anchors on [data-tour="group-invite"]
  // and is skipped when that anchor has nothing in it
  describe('invite tour anchor', () => {
    const inviteAnchor = container => container.querySelector('[data-tour="group-invite"]')

    it('holds the Invite button for a member with limited invite access', () => {
      const { container } = render(<GroupMenuHeader group={{ ...group, id: '5', myInviteAccess: 'limited' }} />)
      expect(inviteAnchor(container).querySelector('button')).toBeInTheDocument()
    })

    it('is empty for a member who cannot invite', () => {
      const { container } = render(<GroupMenuHeader group={{ ...group, id: '5', myInviteAccess: null }} />)
      expect(inviteAnchor(container)).toBeEmptyDOMElement()
    })
  })
})
