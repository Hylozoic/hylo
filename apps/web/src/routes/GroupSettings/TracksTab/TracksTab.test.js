import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import PrivacySettingsTab from './PrivacySettingsTab'

describe('PrivacySettingsTab', () => {
  it('renders correctly', () => {
    const group = {
      id: 1,
      name: 'Foomunity',
      slug: 'foo',
      locationObject: 'Fuji',
      description: 'Great group',
      avatarUrl: 'avatar.png',
      bannerUrl: 'avatar.png',
      accessibility: 1,
      visibility: 1
    }

    render(<PrivacySettingsTab group={group} parentGroups={[]} />)

    // Check for key elements
    expect(screen.getByText('Visibility')).toBeInTheDocument()
    expect(screen.getByText('Access')).toBeInTheDocument()
    expect(screen.getByText('Join Questions')).toBeInTheDocument()
    expect(screen.getByText('Prerequisite Groups')).toBeInTheDocument()
    expect(screen.getByText('Group Access Questions')).toBeInTheDocument()

    // Check for group name in the rendered content
    expect(screen.getByText(/Who is able to see/)).toBeInTheDocument()
    expect(screen.getByText(/How can people become members of/)).toBeInTheDocument()

    // Check for the save button
    expect(screen.getByRole('button', { name: 'Save Changes' })).toBeInTheDocument()
  })
})
