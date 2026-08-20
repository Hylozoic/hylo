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

    expect(screen.getByText('Invite people on Hylo')).toBeInTheDocument()
    expect(screen.getByText('Share a Join Link')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Generate a Link|Reset Link/i })).toBeInTheDocument()
  })
})
