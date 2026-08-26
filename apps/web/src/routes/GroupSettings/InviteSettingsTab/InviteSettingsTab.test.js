import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import InviteSettingsTab from './InviteSettingsTab'

describe('InviteSettingsTab', () => {
  it('renders correctly', () => {
    const group = {
      id: 1,
      name: 'Hylo'
    }

    render(
      <InviteSettingsTab
        group={group}
        regenerateAccessCode={() => {}}
        inviteLink='http://www.hylo.com/c/hylo/join/lalala'
      />
    )

    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate a Link|Reset Link/i })).toBeInTheDocument()
  })

  it('shows a public link for public groups', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      slug: 'hylo',
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Open
    }

    render(<InviteSettingsTab group={group} />)

    expect(screen.getByText('Public Group Link')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
  })

  it('hides the public link for spaces and only shows the join link', () => {
    const group = {
      id: 2,
      name: 'Space',
      slug: 'space',
      type: GROUP_TYPES.space,
      parentId: 1,
      visibility: GROUP_VISIBILITY.Public,
      accessibility: GROUP_ACCESSIBILITY.Open
    }

    render(<InviteSettingsTab group={group} parentGroup={{ id: 1, name: 'Hylo' }} inModal />)

    expect(screen.queryByText('Public Group Link')).not.toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
  })
})
