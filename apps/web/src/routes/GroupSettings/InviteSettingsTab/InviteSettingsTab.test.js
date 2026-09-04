import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { GROUP_ACCESSIBILITY, GROUP_TYPES, GROUP_VISIBILITY } from 'store/models/Group'
import InviteSettingsTab from './InviteSettingsTab'

describe('InviteSettingsTab', () => {
  it('renders correctly', () => {
    const group = {
      id: 1,
      name: 'Hylo',
      invitePath: '/groups/hylo/join/lalala'
    }

    render(
      <InviteSettingsTab
        group={group}
      />
    )

    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate a Link|Reset Link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toBeInTheDocument()
    expect(screen.getByPlaceholderText(/example@domain.com/i)).toBeInTheDocument()
    expect(screen.getByText(/An invitation link will be sent to each email address. They will still be shown any required questions or agreements you may have set to join this group./)).toBeInTheDocument()
    expect(screen.queryByText(/Customize the invite email message/i)).not.toBeInTheDocument()
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
    expect(screen.getByText(/An invitation link will be sent to each email address to join this space. If they are not yet a member of Hylo they will be asked to join that first./)).toBeInTheDocument()
    expect(screen.getByText('Use this link to invite people to the space.')).toBeInTheDocument()
    expect(screen.getByText(/If they are not a member of Hylo they will be given the opportunity to join that first, so make sure you know and trust them./)).toBeInTheDocument()
  })
})
