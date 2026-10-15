import React from 'react'
import { render, screen } from 'util/testing/reactTestingLibraryExtended'
import { GROUP_ACCESSIBILITY, GROUP_VISIBILITY } from 'store/models/Group'
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

  it('does not show who can add new members', () => {
    render(
      <PrivacySettingsTab
        group={{
          id: '1',
          name: 'Seed Library',
          slug: 'seed-library',
          accessibility: GROUP_ACCESSIBILITY.Restricted,
          visibility: GROUP_VISIBILITY.Protected,
          settings: {},
          invitePolicy: 'stewards'
        }}
        parentGroups={[]}
      />
    )

    expect(screen.queryByRole('heading', { name: 'Who can add new members?' })).not.toBeInTheDocument()
  })
})
