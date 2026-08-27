import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
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

    expect(screen.getByText('Invite People')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByText('Send Invites via email')).toBeInTheDocument()

    expect(screen.getByRole('button', { name: /Reset Link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toBeInTheDocument()

    expect(screen.getByPlaceholderText(/example@domain.com/i)).toBeInTheDocument()
    expect(screen.queryByText(/Customize the invite email message/i)).not.toBeInTheDocument()
  })
})
