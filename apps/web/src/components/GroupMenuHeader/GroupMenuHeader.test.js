import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
import GroupMenuHeader from './GroupMenuHeader'
import { groupUrl } from '@hylo/navigation'

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
    expect(screen.getByLabelText(/group avatar/i)).toHaveStyle('background-image: url(avatar.png);')
    expect(screen.getByText('18 Members')).toBeInTheDocument()
  })

  it('renders default avatar and banner if not provided', () => {
    const groupWithoutImages = { ...group, avatarUrl: null, bannerUrl: null }
    render(
      <GroupMenuHeader
        group={groupWithoutImages}
      />
    )
    expect(screen.getByLabelText(/group avatar/i)).toHaveStyle('background-image: url(/default-group-avatar.svg);')
    expect(screen.getByLabelText(/group banner image/i)).toHaveStyle(`background-image: url(/default-group-banner.svg)`) // Assuming DEFAULT_BANNER is 'default-banner.png'
  })

  // this requires svg render for the 'i' button
  // it('toggles details on chevron click', () => {
  //   render(
  //     <GroupMenuHeader
  //       group={group}
  //     />
  //   )
  //   const chevron = screen.getByRole('button')
  //   fireEvent.click(chevron)
  //   expect(screen.getByText('Group Details')).toBeInTheDocument() // Assuming 'Group Details' is part of the GroupDetail component
  //   fireEvent.click(chevron)
  //   expect(screen.queryByText('Group Details')).not.toBeInTheDocument()
  // })

  it('links to the correct group members page', () => {
    render(
      <GroupMenuHeader
        group={group}
      />
    )
    const link = screen.getByText('18 Members')
    expect(link.closest('a')).toHaveAttribute('href', groupUrl(group.slug, 'members', {}))
  })
})
