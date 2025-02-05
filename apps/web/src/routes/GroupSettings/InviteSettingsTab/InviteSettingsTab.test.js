import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
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

    // Check for main sections
    expect(screen.getByText('Invite People')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByText('Send Invites via email')).toBeInTheDocument()

    // Check for group name
    expect(screen.getAllByText(/Hylo/, { exact: false })).toHaveLength(2)

    // Check for invite link
    expect(screen.getByText('http://www.hylo.com/c/hylo/join/lalala')).toBeInTheDocument()

    // Check for buttons
    expect(screen.getByRole('button', { name: /Reset Link/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Send Invite/i })).toBeInTheDocument()

    // Check for text areas
    expect(screen.getByPlaceholderText(/Type email addresses/i)).toBeInTheDocument()
    expect(screen.getByText(/Customize the invite email message/i)).toBeInTheDocument()
  })
})
