import React from 'react'
import { render, screen, AllTheProviders, waitFor } from 'util/testing/reactTestingLibraryExtended'
import UserGroupsTab from './UserGroupsTab'

describe('UserGroupsTab', () => {
  it('renders a list of Memberships and Affiliations', async () => {
    const props = {
      memberships: [
        { id: '1', group: { id: '1', name: 'Group 1' }, person: { id: '1', name: 'Person 1' } },
        { id: '2', group: { id: '2', name: 'Group 2' }, person: { id: '2', name: 'Person 2' } },
        { id: '3', group: { id: '3', name: 'Group 3' }, person: { id: '3', name: 'Person 3' } }
      ],
      affiliations: {
        items: [
          {
            id: '1',
            role: 'Cheesemonger',
            preposition: 'at',
            orgName: 'La Fromagerie',
            url: 'https://www.lafromagerie.com',
            isActive: true
          },
          {
            id: '2',
            role: 'Organizer',
            preposition: 'of',
            orgName: 'Rights of Nature Santa Cruz',
            url: 'https://rightsofnaturesc.org',
            isActive: true
          }
        ]
      },
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />)

    // Check for Memberships
    await waitFor(() => {
      expect(screen.getByText('Group 1')).toBeInTheDocument()
      expect(screen.getByText('Group 2')).toBeInTheDocument()
      expect(screen.getByText('Group 3')).toBeInTheDocument()

      // Check for Affiliations
      expect(screen.getByText('Cheesemonger')).toBeInTheDocument()
      expect(screen.getByText('Rights of Nature Santa Cruz')).toBeInTheDocument()

      // Check for section headers
      expect(screen.getByText('Hylo Groups')).toBeInTheDocument()
      expect(screen.getByText('Other Affiliations')).toBeInTheDocument()
    })
  })

  it('displays loading state when data is not available', async () => {
    const props = {
      memberships: null,
      affiliations: null,
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />)

    await waitFor(() => {
      expect(screen.getByTestId('loading-indicator')).toBeInTheDocument()
    })
  })

  it('allows adding a new affiliation', async () => {
    const props = {
      memberships: [],
      affiliations: { items: [] },
      updateAllGroups: () => {},
      fetchForCurrentUser: jest.fn(() => Promise.resolve({ id: 'validUser' }))
    }

    render(<UserGroupsTab {...props} />)

    await waitFor(() => {
      const addButton = screen.getByText('Add new affiliation')
      expect(addButton).toBeInTheDocument()
      addButton.click()
    })

    await waitFor(() => {
      expect(screen.getByPlaceholderText('Name of role')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Name of organization')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('URL of organization')).toBeInTheDocument()
    })
  })
})

