import React from 'react'
import { render, screen, fireEvent } from 'util/testing/reactTestingLibraryExtended'
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

  describe('commons request section', () => {
    const hiddenGroup = { id: 2, name: 'Quiet Group', slug: 'quiet', accessibility: 1, visibility: 0, allowInPublic: false }
    const selectVisibility = label => fireEvent.click(screen.getByText(label))

    it('appears as soon as Public is selected, asking to save before requesting', () => {
      render(<PrivacySettingsTab group={hiddenGroup} parentGroups={[]} />)
      expect(screen.queryByText('Add my group into the commons')).not.toBeInTheDocument()

      selectVisibility('Public')
      expect(screen.getByText('Add my group into the commons')).toBeInTheDocument()
      expect(screen.getByTestId('commons-request-save-first')).toBeInTheDocument()
      expect(screen.getByTestId('commons-request-button')).toBeDisabled()

      selectVisibility('Hidden')
      expect(screen.queryByText('Add my group into the commons')).not.toBeInTheDocument()
    })

    it('enables the request once the group is saved as Public', () => {
      const { rerender } = render(<PrivacySettingsTab group={hiddenGroup} parentGroups={[]} />)
      selectVisibility('Public')
      rerender(<PrivacySettingsTab group={{ ...hiddenGroup, visibility: 2 }} parentGroups={[]} />)
      expect(screen.queryByTestId('commons-request-save-first')).not.toBeInTheDocument()
      expect(screen.getByTestId('commons-request-button')).toBeEnabled()
    })

    it('shows a pending request for a saved Public group', () => {
      render(<PrivacySettingsTab group={{ ...hiddenGroup, visibility: 2, publicListingRequest: { status: 'pending', requestedAt: '2026-10-01T00:00:00Z' } }} parentGroups={[]} />)
      expect(screen.getByTestId('commons-request-pending')).toBeInTheDocument()
    })

    it('says a group already in the commons is in, even before Public is saved', () => {
      render(<PrivacySettingsTab group={{ ...hiddenGroup, allowInPublic: true }} parentGroups={[]} />)
      selectVisibility('Public')
      expect(screen.getByTestId('commons-request-in-commons')).toBeInTheDocument()
      expect(screen.queryByTestId('commons-request-button')).not.toBeInTheDocument()
    })
  })
})
